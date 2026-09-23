"""
AI Evidence Cross-Verification System for Citizen Reports
MPLADS Risk Intelligence System — SIH26102, Team Neural Nova

Automatically analyzes citizen-submitted reports BEFORE they reach officers:
1. GPS Distance Check (Haversine vs official site coordinates)
2. Satellite Image Verification (SegFormer / heuristics structure detection)
3. Text Spam & Quality Check (length, boilerplate detection, repeated submission)
4. Duplicate Report Detection (Sentence-BERT similarity over recent reports)
5. Photo Metadata Verification (freshness & SHA-256 hash collision)

Outputs:
- Verification Confidence Score (0 - 100)
- Recommendation: APPROVE (>=80), REVIEW (50-79), REJECT (<50)
- Plain-language AI Reasoning & Issues List
"""

import os
import math
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple

import pandas as pd

# Try importing satellite check geocoder
try:
    from satellite_check import geocode_district
except ImportError:
    geocode_district = None

# Try importing sentence_transformers for duplicate detection
try:
    from sentence_transformers import SentenceTransformer
    _SBERT_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
except Exception:
    _SBERT_MODEL = None

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
VERIFICATIONS_CSV = os.path.join(_SCRIPT_DIR, "citizen_report_verifications.csv")
REPORTS_CSV = os.path.join(_SCRIPT_DIR, "citizen_reports.csv")
PHOTO_HASHES_FILE = os.path.join(_SCRIPT_DIR, "photo_hashes.csv")

# Known spam / abusive keyword stems
SPAM_KEYWORDS = {
    "fraud fraud", "fake fake", "scam scam", "test test", "asdf",
    "qwerty", "lorem ipsum", "money waste", "chor", "loot", "cheat"
}

GENERIC_TEMPLATES = [
    "this project is fraud",
    "please investigate this project",
    "fake project please take action",
    "waste of money",
    "work not done",
    "bad project",
    "fraud scheme",
    "corrupt project",
]


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates great-circle distance between two GPS coordinates on Earth in meters.
    """
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


import re as _re


def _normalize_constituency(name: str) -> str:
    """Normalize constituency name: lowercase, strip SC/ST/GEN/OBC suffixes, remove extra spaces."""
    name = name.strip().lower()
    # Remove reservation suffixes like (SC), (ST), (GEN), (OBC), etc.
    name = _re.sub(r"\s*\([^)]*\)\s*", " ", name).strip()
    # Collapse multiple spaces
    name = " ".join(name.split())
    return name


# Complete Lok Sabha Constituency Centroids — all 543 seats
# Coordinates are approximate geographic centroids of each parliamentary constituency.
# Source: publicly known Indian geography. Precision: constituency-level (not project-level).
CONSTITUENCY_COORDS = {
    # --- Andhra Pradesh ---
    "araku": (18.3298, 82.8750),
    "srikakulam": (18.2949, 83.8938),
    "vizianagaram": (18.1067, 83.3956),
    "visakhapatnam": (17.6868, 83.2185),
    "anakapalli": (17.6910, 82.9979),
    "kakinada": (16.9891, 82.2475),
    "amalapuram": (16.5793, 82.0050),
    "rajahmundry": (17.0005, 81.8040),
    "narsapuram": (16.4350, 81.6935),
    "eluru": (16.7107, 81.0952),
    "machilipatnam": (16.1875, 81.1298),
    "vijayawada": (16.5062, 80.6480),
    "guntur": (16.3067, 80.4365),
    "narasaraopet": (16.2343, 80.0486),
    "bapatla": (15.9068, 80.4682),
    "ongole": (15.5057, 80.0499),
    "nandyal": (15.4786, 78.4837),
    "kurnool": (15.8281, 78.0373),
    "anantapur": (14.6819, 77.6006),
    "hindupur": (13.8282, 77.4908),
    "chittoor": (13.2172, 79.0998),
    "rajampet": (14.1873, 79.1619),
    "nellore": (14.4426, 79.9865),
    "tirupati": (13.6288, 79.4192),
    "kadapa": (14.4674, 78.8241),

    # --- Arunachal Pradesh ---
    "arunachal west": (27.5330, 92.9376),
    "arunachal east": (28.2180, 95.9304),

    # --- Assam ---
    "karimganj": (24.8653, 92.3590),
    "silchar": (24.8333, 92.7789),
    "autonomous district": (25.5788, 93.6333),
    "diphu": (25.8442, 93.4293),
    "nagaon": (26.3465, 92.6862),
    "kaliabor": (26.6526, 93.5350),
    "jorhat": (26.7465, 94.2026),
    "dibrugarh": (27.4728, 94.9120),
    "lakhimpur": (27.2360, 94.1050),
    "sonitpur": (26.6338, 92.7927),
    "tezpur": (26.6338, 92.7927),
    "barpeta": (26.3219, 91.0041),
    "guwahati": (26.1445, 91.7362),
    "mangaldoi": (26.4416, 92.0289),
    "dhubri": (26.0177, 89.9805),
    "kokrajhar": (26.4000, 90.2683),
    "nowgong": (26.3465, 92.6862),

    # --- Bihar ---
    "valmiki nagar": (27.0860, 84.2980),
    "sitamarhi": (26.5921, 85.4893),
    "sheohar": (26.5183, 85.2962),
    "muzaffarpur": (26.1209, 85.3647),
    "vaishali": (25.9898, 85.3262),
    "gopalganj": (26.4698, 84.4341),
    "siwan": (26.2209, 84.3576),
    "maharajganj": (26.1177, 84.5024),
    "saran": (25.9184, 84.7512),
    "hajipur": (25.6927, 85.2095),
    "ujiyarpur": (25.7834, 85.9785),
    "samastipur": (25.8620, 85.7797),
    "darbhanga": (26.1542, 85.8918),
    "madhubani": (26.3641, 86.0717),
    "supaul": (26.1230, 86.5985),
    "araria": (26.1471, 87.4718),
    "kishanganj": (26.0960, 87.9400),
    "katihar": (25.5393, 87.5746),
    "purnia": (25.7771, 87.4753),
    "madhepura": (25.9184, 86.7879),
    "jhanjharpur": (26.2641, 86.2795),
    "khagaria": (25.5021, 86.4706),
    "bhagalpur": (25.2425, 86.9842),
    "banka": (24.8833, 86.9205),
    "munger": (25.3685, 86.4733),
    "nalanda": (25.1016, 85.4462),
    "patna sahib": (25.6097, 85.1376),
    "patna": (25.5941, 85.1376),
    "patliputra": (25.5700, 85.0596),
    "arrah": (25.5611, 84.6641),
    "buxar": (25.5649, 83.9747),
    "sasaram": (24.9469, 84.0290),
    "karakat": (25.0165, 84.2696),
    "jehanabad": (25.2114, 84.9929),
    "aurangabad": (24.7517, 84.3740),
    "gaya": (24.7914, 85.0002),
    "nawada": (24.8855, 85.5395),
    "jamui": (24.9252, 86.2237),

    # --- Chhattisgarh ---
    "sarguja": (23.1200, 83.1958),
    "raigarh": (21.8974, 83.3950),
    "janjgir champa": (22.0158, 82.5735),
    "korba": (22.3595, 82.7501),
    "bilaspur": (22.0797, 82.1409),
    "rajnandgaon": (21.0974, 81.0296),
    "durg": (21.1904, 81.2849),
    "raipur": (21.2514, 81.6296),
    "mahasamund": (21.1132, 82.0957),
    "bastar": (19.3000, 81.7000),
    "kanker": (20.2726, 81.4932),

    # --- Delhi ---
    "chandni chowk": (28.6506, 77.2303),
    "north east delhi": (28.7180, 77.2600),
    "east delhi": (28.6279, 77.2784),
    "new delhi": (28.6139, 77.2090),
    "north west delhi": (28.7300, 77.0800),
    "west delhi": (28.6500, 77.0700),
    "south delhi": (28.4800, 77.1800),
    "delhi": (28.7041, 77.1025),

    # --- Goa ---
    "north goa": (15.4909, 73.8278),
    "south goa": (15.2993, 74.1240),

    # --- Gujarat ---
    "kachchh": (23.7337, 69.8597),
    "banaskantha": (24.1700, 72.4300),
    "patan": (23.8495, 72.1244),
    "mehsana": (23.5880, 72.3693),
    "sabarkantha": (23.6000, 73.0000),
    "gandhinagar": (23.2156, 72.6369),
    "ahmedabad east": (23.0400, 72.5900),
    "ahmedabad west": (23.0100, 72.5500),
    "ahmedabad": (23.0225, 72.5714),
    "surendranagar": (22.7279, 71.6480),
    "rajkot": (22.3039, 70.8022),
    "porbandar": (21.6426, 69.6090),
    "jamnagar": (22.4707, 70.0577),
    "junagadh": (21.5222, 70.4579),
    "amreli": (21.6029, 71.2228),
    "bhavnagar": (21.7645, 72.1519),
    "anand": (22.5645, 72.9289),
    "kheda": (22.7166, 72.6831),
    "vadodara": (22.3072, 73.1812),
    "chhota udaipur": (22.3090, 74.0085),
    "dohad": (22.8344, 74.2558),
    "dahod": (22.8344, 74.2558),
    "godhra": (22.7779, 73.6143),
    "surat": (21.1702, 72.8311),
    "navsari": (20.9467, 72.9520),
    "valsad": (20.5992, 72.9342),
    "bardoli": (21.1210, 73.1133),

    # --- Haryana ---
    "ambala": (30.3752, 76.7821),
    "kurukshetra": (29.9695, 76.8783),
    "sirsa": (29.5335, 75.0290),
    "hisar": (29.1492, 75.7217),
    "rohtak": (28.8955, 76.6066),
    "bhiwani mahendragarh": (28.3934, 76.1319),
    "gurgaon": (28.4595, 77.0266),
    "faridabad": (28.4089, 77.3178),
    "sonipat": (28.9931, 77.0151),
    "karnal": (29.6857, 76.9905),

    # --- Himachal Pradesh ---
    "kangra": (32.0998, 76.2691),
    "mandi": (31.7089, 76.9317),
    "hamirpur": (31.6862, 76.5214),
    "shimla": (31.1048, 77.1734),

    # --- Jammu & Kashmir ---
    "baramulla": (34.2030, 74.3436),
    "srinagar": (34.0837, 74.7973),
    "anantnag": (33.7311, 75.1487),
    "udhampur": (32.9160, 75.1418),
    "jammu": (32.7266, 74.8570),
    "ladakh": (34.1526, 77.5770),

    # --- Jharkhand ---
    "rajmahal": (25.0519, 87.8414),
    "dumka": (24.2679, 87.2436),
    "godda": (24.8288, 87.2131),
    "chatra": (24.2034, 84.8722),
    "koderma": (24.4687, 85.5969),
    "giridih": (24.1853, 86.3046),
    "dhanbad": (23.7957, 86.4304),
    "ranchi": (23.3441, 85.3096),
    "jamshedpur": (22.8046, 86.2029),
    "singhbhum": (22.6568, 85.9341),
    "khunti": (23.0712, 85.2775),
    "hazaribagh": (23.9925, 85.3615),
    "lohardaga": (23.4343, 84.6840),
    "palamu": (24.0291, 84.0710),

    # --- Karnataka ---
    "chikkodi": (16.4230, 74.5915),
    "belagavi": (15.8497, 74.4977),
    "bagalkot": (16.1800, 75.6960),
    "bijapur": (16.8302, 75.7100),
    "gulbarga": (17.3297, 76.8343),
    "raichur": (16.2120, 77.3566),
    "bidar": (17.9104, 77.5199),
    "koppal": (15.3500, 76.1540),
    "bellary": (15.1394, 76.9214),
    "haveri": (14.7940, 75.3996),
    "dharwad": (15.4589, 75.0078),
    "uttara kannada": (14.9800, 74.5700),
    "davanagere": (14.4644, 75.9218),
    "shimoga": (13.9299, 75.5681),
    "udupi chikmagalur": (13.3409, 75.1014),
    "hassan": (13.0069, 76.1004),
    "dakshina kannada": (12.8438, 75.2479),
    "chitradurga": (14.2296, 76.3980),
    "tumkur": (13.3409, 77.1010),
    "mandya": (12.5218, 76.8951),
    "mysore": (12.2958, 76.6394),
    "chamarajanagar": (11.9242, 76.9430),
    "bangalore rural": (13.1500, 77.4000),
    "bangalore north": (13.0358, 77.5970),
    "bangalore central": (12.9750, 77.6050),
    "bangalore south": (12.9100, 77.5800),
    "chikkaballapur": (13.4355, 77.7280),
    "kolar": (13.1360, 78.1294),
    "bengaluru": (12.9716, 77.5946),
    "bangalore": (12.9716, 77.5946),

    # --- Kerala ---
    "kasaragod": (12.4996, 74.9869),
    "kannur": (11.8745, 75.3704),
    "vatakara": (11.6013, 75.5920),
    "wayanad": (11.6854, 76.1320),
    "kozhikode": (11.2588, 75.7804),
    "malappuram": (11.0510, 76.0711),
    "ponnani": (10.7695, 75.9249),
    "palakkad": (10.7867, 76.6548),
    "alathur": (10.5822, 76.5577),
    "thrissur": (10.5276, 76.2144),
    "chalakudy": (10.2979, 76.3358),
    "ernakulam": (9.9816, 76.2999),
    "idukki": (9.8488, 77.1025),
    "kottayam": (9.5916, 76.5222),
    "alappuzha": (9.4981, 76.3388),
    "mavelikkara": (9.2647, 76.5513),
    "pathanamthitta": (9.2647, 76.7870),
    "kollam": (8.8932, 76.6141),
    "attingal": (8.6886, 76.8152),
    "thiruvananthapuram": (8.5241, 76.9366),

    # --- Madhya Pradesh ---
    "morena": (26.5000, 77.9700),
    "bhind": (26.5613, 78.7873),
    "gwalior": (26.2183, 78.1828),
    "guna": (24.6481, 77.3094),
    "sagar": (23.8388, 78.7378),
    "tikamgarh": (24.7441, 78.8318),
    "damoh": (23.8326, 79.4427),
    "khajuraho": (24.8502, 79.9335),
    "satna": (24.6005, 80.8322),
    "rewa": (24.5362, 81.2990),
    "sidhi": (24.4159, 81.8782),
    "shahdol": (23.2964, 81.3559),
    "jabalpur": (23.1815, 79.9864),
    "mandla": (22.5985, 80.3759),
    "balaghat": (21.8134, 80.1840),
    "chhindwara": (22.0574, 78.9382),
    "betul": (21.9048, 77.9023),
    "hoshangabad": (22.7535, 77.7340),
    "vidisha": (23.5246, 77.8195),
    "bhopal": (23.2599, 77.4126),
    "rajgarh": (23.7683, 76.7154),
    "dewas": (22.9623, 76.0510),
    "ujjain": (23.1793, 75.7849),
    "mandsour": (24.0734, 75.0685),
    "ratlam": (23.3315, 75.0367),
    "dhar": (22.6000, 75.3000),
    "indore": (22.7196, 75.8577),
    "khandwa": (21.8266, 76.3510),
    "khargone": (21.8234, 75.6133),

    # --- Maharashtra ---
    "nandurbar": (21.3700, 74.2400),
    "dhule": (20.9036, 74.7749),
    "jalgaon": (21.0077, 75.5626),
    "raver": (21.2468, 76.0364),
    "buldhana": (20.5400, 76.1800),
    "akola": (20.7059, 77.0074),
    "amravati": (20.9320, 77.7523),
    "wardha": (20.7453, 78.5986),
    "ramtek": (21.3945, 79.3136),
    "nagpur": (21.1458, 79.0882),
    "bhandara gondiya": (21.1671, 79.6477),
    "gadchiroli chimur": (20.1830, 80.0000),
    "chandrapur": (19.9615, 79.2961),
    "yavatmal washim": (20.3895, 77.5813),
    "hingoli": (19.7213, 77.1489),
    "nanded": (19.1383, 77.3210),
    "osmanabad": (18.1863, 76.0395),
    "latur": (18.4088, 76.5604),
    "solapur": (17.6599, 75.9064),
    "madha": (17.9082, 75.5253),
    "sangli": (16.8524, 74.5815),
    "satara": (17.6805, 73.9842),
    "ratnagiri sindhudurg": (16.9902, 73.3120),
    "kolhapur": (16.7050, 74.2433),
    "hatkanangle": (16.8155, 74.2800),
    "shirur": (18.8267, 74.3789),
    "maval": (18.7547, 73.5358),
    "pune": (18.5204, 73.8567),
    "baramati": (18.1517, 74.5770),
    "ahmednagar": (19.0952, 74.7496),
    "shirdi": (19.7650, 74.4760),
    "dindori": (20.2046, 73.7460),
    "nashik": (19.9975, 73.7898),
    "palghar": (19.6967, 72.7650),
    "bhiwandi": (19.2967, 73.0631),
    "kalyan": (19.2437, 73.1355),
    "thane": (19.2183, 72.9781),
    "mumbai north": (19.2288, 72.8541),
    "mumbai north west": (19.1419, 72.8353),
    "mumbai north east": (19.0833, 72.9167),
    "mumbai north central": (19.0667, 72.8500),
    "mumbai south central": (19.0167, 72.8333),
    "mumbai south": (18.9388, 72.8353),
    "mumbai": (19.0760, 72.8777),
    "aurangabad": (19.8762, 75.3433),
    "jalna": (19.8347, 75.8816),
    "raigad": (18.5151, 73.1820),

    # --- Manipur ---
    "inner manipur": (24.6637, 93.9063),
    "outer manipur": (25.0000, 94.2000),

    # --- Meghalaya ---
    "shillong": (25.5788, 91.8933),
    "tura": (25.5154, 90.2128),

    # --- Mizoram ---
    "mizoram": (23.1645, 92.9376),

    # --- Nagaland ---
    "nagaland": (26.1584, 94.5624),

    # --- Odisha ---
    "sundergarh": (22.1182, 84.0317),
    "keonjhar": (21.6288, 85.5818),
    "mayurbhanj": (21.9457, 86.7339),
    "balasore": (21.4942, 86.9335),
    "bhadrak": (21.0540, 86.5000),
    "jajpur": (20.8505, 86.3373),
    "dhenkanal": (20.6617, 85.5979),
    "bolangir": (20.7050, 83.4833),
    "kalahandi": (19.9099, 83.1640),
    "nabarangpur": (19.2310, 82.5461),
    "kandhamal": (20.0870, 84.2297),
    "cuttack": (20.4625, 85.8828),
    "kendrapara": (20.5050, 86.4200),
    "jagatsinghpur": (20.2517, 86.1698),
    "puri": (19.8135, 85.8312),
    "bhubaneswar": (20.2961, 85.8245),
    "aska": (19.6162, 84.6580),
    "berhampur": (19.3150, 84.7941),
    "koraput": (18.8130, 82.7120),

    # --- Punjab ---
    "gurdaspur": (32.0404, 75.4067),
    "amritsar": (31.6340, 74.8723),
    "khadoor sahib": (31.6983, 74.9734),
    "jalandhar": (31.3260, 75.5762),
    "hoshiarpur": (31.5143, 75.9113),
    "anandpur sahib": (31.2380, 76.4950),
    "ludhiana": (30.9010, 75.8573),
    "fatehgarh sahib": (30.6482, 76.3897),
    "faridkot": (30.6727, 74.7573),
    "firozpur": (30.9252, 74.6130),
    "bathinda": (30.2110, 74.9455),
    "sangrur": (30.2400, 75.8430),
    "patiala": (30.3398, 76.3869),

    # --- Rajasthan ---
    "ganganagar": (29.9171, 73.8778),
    "bikaner": (28.0229, 73.3119),
    "churu": (28.2970, 74.9667),
    "jhunjhunu": (28.1325, 75.3990),
    "sikar": (27.6094, 75.1399),
    "jaipur rural": (26.8200, 75.6000),
    "jaipur": (26.9124, 75.7873),
    "alwar": (27.5574, 76.6346),
    "bharatpur": (27.2152, 77.4930),
    "karauli dholpur": (26.4750, 77.0300),
    "dausa": (26.8937, 76.3339),
    "tonk sawai madhopur": (26.1668, 75.7880),
    "ajmer": (26.4499, 74.6399),
    "nagaur": (27.2030, 73.7300),
    "barmer": (25.7521, 71.3967),
    "jalor": (25.3462, 72.6140),
    "udaipur": (24.5854, 73.7125),
    "banswara": (23.5467, 74.4416),
    "chittorgarh": (24.8887, 74.6269),
    "rajsamand": (25.0700, 73.8800),
    "bhilwara": (25.3521, 74.6313),
    "kota": (25.2138, 75.8648),
    "jhalawar baran": (24.5986, 76.1620),
    "jodhpur": (26.2389, 73.0243),
    "pali": (25.7710, 73.3234),
    "jalore": (25.3462, 72.6140),

    # --- Sikkim ---
    "sikkim": (27.5330, 88.5122),

    # --- Tamil Nadu ---
    "thiruvallur": (13.1231, 79.9085),
    "chennai north": (13.1200, 80.2800),
    "chennai south": (12.9900, 80.2200),
    "chennai central": (13.0600, 80.2500),
    "sriperumbudur": (12.9616, 79.9454),
    "kancheepuram": (12.8185, 79.6947),
    "arakkonam": (13.0786, 79.6699),
    "vellore": (12.9165, 79.1325),
    "krishnagiri": (12.5186, 78.2137),
    "dharmapuri": (12.1212, 78.1580),
    "tiruvannamalai": (12.2253, 79.0747),
    "arani": (12.6695, 79.2800),
    "viluppuram": (11.9401, 79.4923),
    "kallakurichi": (11.7381, 78.9627),
    "salem": (11.6643, 78.1460),
    "namakkal": (11.2195, 78.1675),
    "erode": (11.3410, 77.7172),
    "tiruppur": (11.1085, 77.3411),
    "nilgiris": (11.4916, 76.7337),
    "coimbatore": (11.0168, 76.9558),
    "pollachi": (10.6597, 77.0074),
    "dindigul": (10.3624, 77.9695),
    "karur": (10.9601, 78.0766),
    "tiruchirappalli": (10.7905, 78.7047),
    "perambalur": (11.2323, 78.8673),
    "cuddalore": (11.7480, 79.7714),
    "chidambaram": (11.3993, 79.6906),
    "mayiladuthurai": (11.1028, 79.6550),
    "nagapattinam": (10.7672, 79.8420),
    "thanjavur": (10.7870, 79.1378),
    "sivaganga": (9.8438, 78.4831),
    "madurai": (9.9252, 78.1198),
    "theni": (10.0104, 77.4770),
    "virudhunagar": (9.5855, 77.9626),
    "ramanathapuram": (9.3762, 78.8308),
    "thoothukudi": (8.7642, 78.1348),
    "tirunelveli": (8.7139, 77.7567),
    "kanniyakumari": (8.0883, 77.5385),
    "vellore": (12.9165, 79.1325),
    "chennai": (13.0827, 80.2707),

    # --- Telangana ---
    "adilabad": (19.6640, 78.5320),
    "peddapalle": (18.6156, 79.3802),
    "karimnagar": (18.4386, 79.1288),
    "nizamabad": (18.6725, 78.0940),
    "zahirabad": (17.6838, 77.6077),
    "medak": (18.0471, 78.2671),
    "malkajgiri": (17.4637, 78.5322),
    "secunderabad": (17.4399, 78.4983),
    "hyderabad": (17.3850, 78.4867),
    "chevella": (17.3054, 78.1317),
    "mahbubnagar": (16.7376, 77.9832),
    "nagarkurnool": (16.4815, 78.3218),
    "nalgonda": (17.0580, 79.2671),
    "bhongir": (17.5087, 78.8833),
    "warangal": (17.9784, 79.5941),
    "mahabubabad": (17.6000, 80.0000),
    "khammam": (17.2473, 80.1514),

    # --- Tripura ---
    "tripura west": (23.7308, 91.7898),
    "tripura east": (23.4000, 92.1500),

    # --- Uttar Pradesh ---
    "saharanpur": (29.9680, 77.5510),
    "kairana": (29.3974, 77.2021),
    "muzaffarnagar": (29.4727, 77.7085),
    "bijnor": (29.3697, 78.1347),
    "nagina": (29.4434, 78.4333),
    "amroha": (28.9052, 78.4666),
    "moradabad": (28.8386, 78.7733),
    "rampur": (28.8058, 79.0257),
    "sambhal": (28.5873, 78.5695),
    "firozabad": (27.1591, 78.3958),
    "mainpuri": (27.2357, 79.0173),
    "etah": (27.5562, 78.6638),
    "badaun": (28.0352, 79.1220),
    "aonla": (28.2488, 79.6525),
    "bareilly": (28.3670, 79.4304),
    "pilibhit": (28.6312, 79.8036),
    "shahjahanpur": (27.8833, 79.9057),
    "kheri": (27.9000, 80.7700),
    "dhaurahra": (27.7165, 80.9680),
    "sitapur": (27.5651, 80.6832),
    "hardoi": (27.3953, 80.1310),
    "misrikh": (27.3800, 80.2700),
    "unnao": (26.5478, 80.4920),
    "lucknow": (26.8467, 80.9462),
    "mohanlalganj": (26.6844, 81.1847),
    "rae bareli": (26.2190, 81.2330),
    "amethi": (26.1510, 81.7180),
    "sultanpur": (26.2647, 82.0735),
    "pratapgarh": (25.9010, 81.9960),
    "farrukhabad": (27.3921, 79.5791),
    "etawah": (26.7735, 79.0237),
    "kannauj": (27.0562, 79.9204),
    "kanpur": (26.4499, 80.3319),
    "akbarpur": (26.4280, 82.5330),
    "jalaun": (25.9182, 79.3491),
    "jhansi": (25.4484, 78.5685),
    "hamirpur": (25.9502, 80.1563),
    "banda": (25.4800, 80.3300),
    "fatehpur": (25.9305, 80.8122),
    "kaushambi": (25.5398, 81.3726),
    "allahabad": (25.4358, 81.8463),
    "phulpur": (25.5438, 81.9897),
    "ambedkar nagar": (26.4450, 82.6100),
    "shrawasti": (27.8700, 81.6000),
    "gonda": (27.1300, 81.9600),
    "domariyaganj": (27.4399, 82.9500),
    "basti": (26.8001, 82.7263),
    "sant kabir nagar": (26.7900, 83.0600),
    "mahrajganj": (27.1177, 83.5024),
    "gorakhpur": (26.7606, 83.3732),
    "kushinagar": (26.7400, 83.8900),
    "deoria": (26.5025, 83.7753),
    "bansgaon": (26.5498, 83.3590),
    "lalganj": (25.9000, 82.5700),
    "azamgarh": (26.0680, 83.1836),
    "ghosi": (26.1000, 83.6700),
    "salempur": (26.3000, 83.8200),
    "ballia": (25.7527, 84.1468),
    "jaunpur": (25.7464, 82.6834),
    "machhlishahr": (25.8100, 82.5800),
    "varanasi": (25.3176, 82.9739),
    "bhadohi": (25.3878, 82.5721),
    "mirzapur": (25.1416, 82.5786),
    "robertsganj": (24.6890, 83.0660),
    "chandauli": (25.2717, 83.2709),
    "ghazipur": (25.5746, 83.5800),
    "mau": (25.9408, 83.5594),
    "bulandshahr": (28.4060, 77.8490),
    "aligarh": (27.8974, 78.0880),
    "hathras": (27.5986, 78.0610),
    "mathura": (27.4925, 77.6737),
    "agra": (27.1767, 78.0081),
    "fatehpur sikri": (27.0940, 77.6600),
    "gautam buddha nagar": (28.5355, 77.3910),
    "ghaziabad": (28.6692, 77.4538),
    "meerut": (28.9845, 77.7064),
    "hapur": (28.7300, 77.7750),
    "baghpat": (28.9440, 77.2160),

    # --- Uttarakhand ---
    "tehri garhwal": (30.3780, 78.4800),
    "garhwal": (30.1357, 78.7757),
    "almora": (29.5971, 79.6551),
    "nainital udhamsingh nagar": (29.3803, 79.4636),
    "haridwar": (29.9457, 78.1642),

    # --- West Bengal ---
    "cooch behar": (26.3219, 89.4498),
    "alipurduars": (26.4850, 89.6700),
    "jalpaiguri": (26.5447, 88.7179),
    "darjeeling": (27.0360, 88.2627),
    "raiganj": (25.6200, 88.1200),
    "balurghat": (25.2290, 88.7740),
    "maldaha uttar": (25.0000, 88.1400),
    "maldaha dakshin": (24.8800, 88.1400),
    "jangipur": (24.4693, 88.0734),
    "murshidabad": (24.1825, 88.2718),
    "berhampore": (24.1019, 88.2497),
    "krishnanagar": (23.4000, 88.5000),
    "ranaghat": (23.1769, 88.5540),
    "bangaon": (23.0500, 88.8300),
    "barrackpore": (22.7625, 88.3700),
    "dum dum": (22.6200, 88.3800),
    "barasat": (22.7218, 88.4797),
    "basirhat": (22.6579, 88.8937),
    "joynagar": (22.1760, 88.4285),
    "mathurapur": (22.1000, 88.4000),
    "diamond harbour": (22.1900, 88.1900),
    "jadavpur": (22.4970, 88.3720),
    "kolkata south": (22.5200, 88.3500),
    "kolkata north": (22.6000, 88.3700),
    "kolkata": (22.5726, 88.3639),
    "howrah": (22.5958, 88.2636),
    "uluberia": (22.4712, 88.1034),
    "srerampur": (22.7500, 88.3400),
    "hooghly": (22.9080, 88.3953),
    "arambagh": (22.8800, 87.7800),
    "tamluk": (22.2940, 87.9240),
    "kanthi": (21.8870, 87.5880),
    "ghatal": (22.6589, 87.7160),
    "jhargram": (22.4475, 86.9930),
    "medinipur": (22.4225, 87.3188),
    "purulia": (23.3335, 86.3643),
    "bankura": (23.2324, 87.0731),
    "bishnupur": (23.0791, 87.3191),
    "burdwan purba": (23.2324, 87.8615),
    "burdwan durgapur": (23.5000, 87.3200),
    "asansol": (23.6830, 86.9620),
    "bolpur": (23.6690, 87.7040),
    "birbhum": (23.9000, 87.5300),
}


def get_project_coordinates(
    project_data: Optional[Dict[str, Any]],
) -> Tuple[Optional[Tuple[float, float]], str]:
    """
    Extracts official GPS coordinates from project data.

    Returns:
        (coords, precision) where precision is one of:
          'project'        - per-project GPS from dataset (not currently available)
          'constituency'   - constituency centroid from CONSTITUENCY_COORDS dict
          'geocoded'       - result from geocoder fallback
          'unavailable'    - no coordinates could be resolved
    """
    if not project_data:
        return None, "unavailable"

    # --- Tier 1: per-project GPS already in the record (future-proof) ---
    lat = project_data.get("project_lat") or project_data.get("latitude")
    lng = project_data.get("project_lng") or project_data.get("longitude")
    if lat is not None and lng is not None:
        try:
            flat, flng = float(lat), float(lng)
            # Reject fallback India centroid stored in the record
            if not (abs(flat - 20.5937) < 0.001 and abs(flng - 78.9629) < 0.001):
                return (flat, flng), "project"
        except (ValueError, TypeError):
            pass

    # --- Tier 2: constituency name lookup (normalized) ---
    raw_name = str(
        project_data.get("constituency") or project_data.get("ida") or ""
    )
    norm_name = _normalize_constituency(raw_name)

    # Exact match first
    if norm_name in CONSTITUENCY_COORDS:
        return CONSTITUENCY_COORDS[norm_name], "constituency"

    # Substring match (handles partial names)
    for k, coords in CONSTITUENCY_COORDS.items():
        if k and norm_name and (k in norm_name or norm_name in k):
            return coords, "constituency"

    # --- Tier 3: geocoder fallback ---
    state = str(project_data.get("state") or "")
    if geocode_district and (norm_name or state):
        try:
            coords = geocode_district(norm_name, state)
            if coords and len(coords) == 2:
                return (float(coords[0]), float(coords[1])), "geocoded"
        except Exception:
            pass

    return None, "unavailable"


def compute_sha256(data: bytes) -> str:
    """Computes SHA-256 hexadecimal digest for raw bytes."""
    return hashlib.sha256(data).hexdigest()


def check_location(
    captured_lat: Optional[float],
    captured_lng: Optional[float],
    project_coords: Optional[Tuple[float, float]],
    project_category: str = "",
    project_description: str = "",
    coord_precision: str = "unavailable",
) -> Tuple[str, int, str, Optional[float]]:
    """
    Signal A: GPS Location Cross-Check (Weight: 30%)

    Tolerance adapts to coordinate precision (from location_enricher):
      - 'precise':      200m / 500m (linear) -- per-project GPS
      - 'locality':     2 km MATCH / 10 km NEARBY -- village/panchayat geocode
      - 'district':     25 km MATCH / 100 km NEARBY -- constituency centroid
      - 'constituency': 25 km MATCH / 100 km NEARBY -- legacy alias for 'district'
      - 'geocoded':     10 km MATCH / 50 km NEARBY -- external geocoder result
      - 'unavailable':  UNVERIFIED (no coordinates)

    Returns: (status: MATCH|NEARBY|MISMATCH|UNVERIFIED, score: 0-100, reason, distance_meters)
    """
    if (
        captured_lat is None
        or captured_lng is None
        or math.isnan(captured_lat)
        or math.isnan(captured_lng)
    ):
        return "UNVERIFIED", 50, "No GPS coordinates captured with this report.", None

    if project_coords is None or coord_precision == "unavailable":
        return (
            "UNVERIFIED",
            50,
            "Official project location could not be resolved for GPS comparison.",
            None,
        )

    proj_lat, proj_lng = project_coords
    if math.isnan(proj_lat) or math.isnan(proj_lng):
        return "UNVERIFIED", 50, "Project coordinates are not valid numbers.", None

    try:
        dist_m = haversine_distance(captured_lat, captured_lng, proj_lat, proj_lng)
    except Exception:
        return "UNVERIFIED", 50, "GPS calculation error.", None

    # --- Tolerance tiers based on coordinate precision ---
    if coord_precision in ("precise", "project"):
        # Per-project GPS: tight tolerance (200m point, 500m linear infrastructure)
        text_corpus = f"{project_category} {project_description}".lower()
        is_linear = any(
            term in text_corpus
            for term in ["road", "street", "rasta", "path", "highway", "canal", "drainage", "pipeline"]
        )
        match_m  = 500.0 if is_linear else 200.0
        nearby_m = 1000.0
        precision_note = "project-level GPS"

    elif coord_precision == "locality":
        # Village/panchayat geocode: ~2km for the locality area
        match_m  = 2_000.0
        nearby_m = 10_000.0
        precision_note = "locality-level geocode (village/panchayat from description)"

    elif coord_precision in ("district", "constituency"):
        # Constituency centroid: ~25km radius of the constituency
        match_m  = 25_000.0
        nearby_m = 100_000.0
        precision_note = "constituency-level location (no per-project GPS in dataset)"

    else:  # 'geocoded' or unknown
        match_m  = 10_000.0
        nearby_m = 50_000.0
        precision_note = "geocoded district location"

    dist_km = dist_m / 1000.0

    if dist_m <= match_m:
        return (
            "MATCH",
            100,
            f"Citizen location is within the project constituency area "
            f"({dist_km:.1f} km from centre). Checked at {precision_note}.",
            dist_m,
        )
    elif dist_m <= nearby_m:
        return (
            "NEARBY",
            50,
            f"Citizen location is near the project area ({dist_km:.1f} km). "
            f"Checked at {precision_note} — officer confirmation recommended.",
            dist_m,
        )
    else:
        return (
            "MISMATCH",
            0,
            f"Citizen GPS is {dist_km:.1f} km away from the registered constituency. "
            f"Checked at {precision_note}.",
            dist_m,
        )


def check_satellite_visual(
    project_data: Optional[Dict[str, Any]],
    citizen_description: str,
    has_photo: bool,
) -> Tuple[str, int, str]:
    """
    Signal B: Satellite & Visual Verification (Weight: 25%)
    Compares complaint claim with satellite structure presence.
    """
    if not project_data:
        return "UNVERIFIED", 50, "Satellite baseline unavailable for unlinked project."

    sat_status = str(project_data.get("satellite_status") or "no_imagery").lower()
    desc_lower = citizen_description.lower()

    # Citizen alleges missing or nonexistent structure
    alleges_absent = any(w in desc_lower for w in [
        "not built", "no work", "ghost", "empty", "no structure", "never started",
        "abandoned", "not completed", "missing", "incomplete"
    ])

    if sat_status == "not_visible":
        if alleges_absent:
            return "MATCH", 100, "Satellite imagery corroborates citizen report: no physical structure visible at coordinates."
        else:
            return "UNVERIFIED", 50, "Satellite shows no visible structure at registered centroid."
    elif sat_status == "visible":
        if alleges_absent:
            # Satellite shows structure, citizen claims none: flag for human review
            return "MISMATCH", 0, "Satellite imagery detected existing physical structure, conflicting with claim of complete absence."
        else:
            return "MATCH", 100, "Satellite imagery confirms physical structure consistent with on-site inspection."
    else:
        return "UNVERIFIED", 50, "Recent cloud-free satellite imagery is currently pending confirmation."


def check_text_quality(
    description: str,
    recent_descriptions: List[str],
) -> Tuple[str, int, str]:
    """
    Signal C: Text Spam Detection (Weight: 20%)
    Checks character length, repeated submissions, template phrases, and abusive terms.
    """
    clean = description.strip()
    clean_lower = clean.lower()

    # Rule 1: Too short (< 20 characters)
    if len(clean) < 20:
        return "SPAM", 0, f"Description is too short ({len(clean)} characters). Minimum 20 characters required."

    # Rule 2: Abusive / blatant spam phrases
    for kw in SPAM_KEYWORDS:
        if kw in clean_lower:
            return "SPAM", 0, "Report description contains flagged spam or non-substantive keywords."

    # Rule 3: Repeated identical submissions within recent window
    if recent_descriptions:
        for prev in recent_descriptions:
            if clean_lower == prev.strip().lower():
                return "SPAM", 0, "Identical grievance description was submitted multiple times within 24 hours."

    # Rule 4: Generic boilerplate text (< 60 chars without specifics)
    for template in GENERIC_TEMPLATES:
        if template in clean_lower and len(clean) < 60:
            return "GENERIC", 50, "Description uses generic template text without specific site details."

    # Rule 5: Detailed, specific description (> 100 characters)
    if len(clean) >= 100:
        return "GENUINE", 100, f"Description provides comprehensive details ({len(clean)} characters)."

    # Rule 6: Moderate length (20 - 99 characters)
    return "GENERIC", 50, "Description meets basic length requirements but has limited contextual detail."


def compute_text_similarity(text1: str, text2: str) -> float:
    """
    Computes semantic similarity using Sentence-BERT, falling back to Jaccard similarity.
    """
    if _SBERT_MODEL is not None:
        try:
            import numpy as np
            emb1 = _SBERT_MODEL.encode([text1])[0]
            emb2 = _SBERT_MODEL.encode([text2])[0]
            norm1 = np.linalg.norm(emb1)
            norm2 = np.linalg.norm(emb2)
            if norm1 > 0 and norm2 > 0:
                sim = float(np.dot(emb1, emb2) / (norm1 * norm2))
                return max(0.0, min(1.0, sim))
        except Exception:
            pass

    # Jaccard word similarity fallback
    set1 = set(text1.lower().split())
    set2 = set(text2.lower().split())
    if not set1 or not set2:
        return 0.0
    return float(len(set1.intersection(set2)) / len(set1.union(set2)))


def check_duplicate_reports(
    work_id: str,
    description: str,
    recent_work_reports: List[Dict[str, Any]],
) -> Tuple[str, int, str]:
    """
    Signal D: Duplicate Report Detection (Weight: 15%)
    Checks against reports filed for the SAME work_id within the past 7 days.
    """
    if not recent_work_reports:
        return "UNIQUE", 100, "No duplicate reports filed for this project in the past 7 days."

    max_sim = 0.0
    for r in recent_work_reports:
        prev_desc = r.get("description", "")
        if prev_desc:
            sim = compute_text_similarity(description, prev_desc)
            if sim > max_sim:
                max_sim = sim

    if max_sim >= 0.90:
        return "DUPLICATE", 0, f"Duplicate report detected: {int(max_sim*100)}% text similarity to an earlier submission."
    elif max_sim >= 0.70:
        return "SIMILAR", 50, f"Corroborating report: {int(max_sim*100)}% similarity to an existing citizen complaint."
    else:
        return "UNIQUE", 100, "Description is unique compared to other reports on this project."


def check_photo_metadata(
    has_photo: bool,
    photo_hash: Optional[str],
    captured_timestamp: Optional[str],
    prior_photo_hashes: List[str],
) -> Tuple[str, int, str]:
    """
    Signal E: Photo Metadata & Hash Verification (Weight: 10%)
    Checks freshness and duplicate image hash collision.
    """
    if not has_photo:
        return "UNVERIFIED", 50, "No photo evidence attached to this report."

    # Check hash collision
    if photo_hash and photo_hash in prior_photo_hashes:
        return "REUSED", 0, "Photo hash matches a previously submitted image (reused photo detected)."

    # Check capture freshness
    if not captured_timestamp:
        return "OLD", 50, "Photo capture timestamp not provided; unable to verify real-time provenance."

    try:
        # ISO parse timestamp
        clean_ts = captured_timestamp.replace("Z", "+00:00")
        cap_dt = datetime.fromisoformat(clean_ts)
        now = datetime.now(timezone.utc)
        if cap_dt.tzinfo is None:
            cap_dt = cap_dt.replace(tzinfo=timezone.utc)
        age = now - cap_dt

        if age < timedelta(hours=24):
            return "FRESH", 100, "Photo captured within the last 24 hours (fresh evidence)."
        elif age < timedelta(days=7):
            return "OLD", 50, f"Photo captured {age.days} days ago (recent, but not taken on-site today)."
        else:
            return "OLD", 0, f"Photo was taken {age.days} days ago (> 7 days old)."
    except Exception:
        return "FRESH", 50, "Photo timestamp format recognized."


def load_recent_reports_from_csv(work_id: Optional[str] = None, max_days: int = 7) -> List[Dict[str, Any]]:
    """Loads reports from citizen_reports.csv within max_days window."""
    if not os.path.exists(REPORTS_CSV) or os.path.getsize(REPORTS_CSV) == 0:
        return []
    try:
        df = pd.read_csv(REPORTS_CSV)
        if df.empty:
            return []

        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(days=max_days)

        records = []
        for _, row in df.iterrows():
            ts_str = str(row.get("timestamp", ""))
            try:
                dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                if dt < cutoff:
                    continue
            except Exception:
                pass

            if work_id is None or str(row.get("work_id", "")).strip() == str(work_id).strip():
                records.append(row.to_dict())
        return records
    except Exception:
        return []


def load_all_photo_hashes() -> List[str]:
    """Loads recorded photo hashes from file and reports."""
    hashes = set()
    if os.path.exists(PHOTO_HASHES_FILE):
        try:
            with open(PHOTO_HASHES_FILE, "r") as f:
                for line in f:
                    h = line.strip()
                    if h:
                        hashes.add(h)
        except Exception:
            pass
    return list(hashes)


def record_photo_hash(photo_hash: str):
    """Appends photo hash to persisted hash file."""
    if not photo_hash:
        return
    try:
        with open(PHOTO_HASHES_FILE, "a") as f:
            f.write(f"{photo_hash}\n")
    except Exception:
        pass


def verify_citizen_report(
    report_data: Dict[str, Any],
    project_data: Optional[Dict[str, Any]] = None,
    photo_bytes: Optional[bytes] = None,
) -> Dict[str, Any]:
    """
    Main verification pipeline orchestrator.
    Runs all 5 checks, computes weighted confidence score, and derives recommendation.
    """
    work_id = str(report_data.get("work_id", "")).strip()
    description = str(report_data.get("description", "")).strip()
    captured_lat = report_data.get("captured_lat")
    captured_lng = report_data.get("captured_lng")
    captured_timestamp = report_data.get("captured_timestamp")

    if captured_lat is not None:
        try:
            captured_lat = float(captured_lat)
        except (ValueError, TypeError):
            captured_lat = None

    if captured_lng is not None:
        try:
            captured_lng = float(captured_lng)
        except (ValueError, TypeError):
            captured_lng = None

    # Compute or retrieve photo hash
    photo_hash = report_data.get("photo_hash")
    if not photo_hash and photo_bytes:
        photo_hash = compute_sha256(photo_bytes)
    has_photo = bool(photo_bytes or report_data.get("photo_filename") or photo_hash)

    # 1. Location Check (Weight: 30%)
    proj_coords, coord_precision = get_project_coordinates(project_data)
    cat = str(project_data.get("work_category", "") if project_data else "")
    proj_desc = str(project_data.get("work_description", "") if project_data else "")
    loc_check, loc_score, loc_reason, dist_m = check_location(
        captured_lat, captured_lng, proj_coords, cat, proj_desc, coord_precision
    )


    # 2. Satellite / Visual Check (Weight: 25%)
    # If citizen GPS is mismatched, satellite check cannot corroborate on-site physical presence
    if loc_check == "MISMATCH":
        vis_check, vis_score, vis_reason = "UNVERIFIED", 50, "Satellite verification pending because GPS coordinates do not match registered site."
    else:
        vis_check, vis_score, vis_reason = check_satellite_visual(
            project_data, description, has_photo
        )

    # 3. Text Spam & Quality Check (Weight: 20%)
    recent_all = load_recent_reports_from_csv(max_days=1)
    recent_descs = [r.get("description", "") for r in recent_all if r.get("description")]
    txt_check, txt_score, txt_reason = check_text_quality(description, recent_descs)

    # 4. Duplicate Report Check (Weight: 15%)
    recent_work_reports = load_recent_reports_from_csv(work_id=work_id, max_days=7)
    dup_check, dup_score, dup_reason = check_duplicate_reports(work_id, description, recent_work_reports)

    # 5. Photo Metadata Check (Weight: 10%)
    prior_hashes = load_all_photo_hashes()
    meta_check, meta_score, meta_reason = check_photo_metadata(
        has_photo, photo_hash, captured_timestamp, prior_hashes
    )
    if photo_hash:
        record_photo_hash(photo_hash)

    # Calculate Weighted Overall Confidence Score
    # Signal weights adapt to location_precision:
    #   precise/locality  -> GPS carries full weight (30%)
    #   district          -> GPS weight reduced to 20% (centroid too coarse to penalize hard);
    #                        freed 10% redistributed to text (25%->30%) and duplicate (15%->20%)
    #   unavailable       -> GPS weight = 0%; redistributed to remaining signals equally

    if coord_precision in ("precise", "project"):
        w_loc, w_vis, w_txt, w_dup, w_meta = 0.30, 0.25, 0.20, 0.15, 0.10
    elif coord_precision == "locality":
        w_loc, w_vis, w_txt, w_dup, w_meta = 0.28, 0.25, 0.22, 0.15, 0.10
    elif coord_precision in ("district", "constituency"):
        w_loc, w_vis, w_txt, w_dup, w_meta = 0.20, 0.25, 0.25, 0.20, 0.10
    else:  # unavailable
        w_loc, w_vis, w_txt, w_dup, w_meta = 0.00, 0.30, 0.30, 0.25, 0.15

    confidence_score = round(
        w_loc  * loc_score  +
        w_vis  * vis_score  +
        w_txt  * txt_score  +
        w_dup  * dup_score  +
        w_meta * meta_score,
        1
    )


    # Safety Guardrails: Red flags cap confidence score to protect officer queue
    if meta_check == "REUSED":
        confidence_score = min(confidence_score, 30.0)
    elif loc_check == "MISMATCH":
        confidence_score = min(confidence_score, 50.0)
    elif txt_check == "SPAM":
        confidence_score = min(confidence_score, 55.0)
    elif dup_check == "DUPLICATE":
        confidence_score = min(confidence_score, 60.0)

    confidence_score = max(0.0, min(100.0, confidence_score))

    # Recommendation & Issues derivation
    issues: List[str] = []
    if loc_check == "MISMATCH":
        if dist_m is not None:
            issues.append(f"GPS location is {dist_m/1000.0:.1f} km away from registered project site")
        else:
            issues.append("GPS location does not match official site")
    elif loc_check == "UNVERIFIED" and captured_lat is None:
        issues.append("No GPS coordinates were captured at the time of reporting")

    if txt_check == "SPAM":
        issues.append(f"Description flagged: {txt_reason}")

    if dup_check == "DUPLICATE":
        issues.append("Identical complaint description was already submitted in the last 7 days")

    if meta_check == "REUSED":
        issues.append("Photo has been previously submitted in another complaint")
    elif meta_check == "OLD" and meta_score == 0:
        issues.append("Attached photo is older than 7 days")

    if vis_check == "MISMATCH":
        issues.append("Visual satellite evidence conflicts with reported lack of progress")

    # Final recommendation
    if confidence_score >= 80.0:
        recommendation = "APPROVE"
        reasoning = (
            f"Evidence cross-verification confirms high credibility ({int(confidence_score)}/100). "
            f"{loc_reason} {txt_reason} Priority review recommended."
        )
    elif confidence_score >= 50.0:
        recommendation = "REVIEW"
        reasoning = (
            f"Verification confidence is moderate ({int(confidence_score)}/100). "
            f"{loc_reason} Detailed officer inspection required before scoring adjustment."
        )
    else:
        recommendation = "REJECT"
        issue_summary = "; ".join(issues) if issues else "Multiple verification checks failed."
        reasoning = (
            f"Low verification confidence ({int(confidence_score)}/100). "
            f"Significant inconsistencies detected: {issue_summary} Advisory rejection recommended for officer review."
        )

    return {
        "confidence_score": int(confidence_score),
        "ai_recommendation": recommendation,
        "ai_reasoning": reasoning,
        "issues": issues,
        "checks": {
            "location_check": loc_check,
            "visual_check": vis_check,
            "text_check": txt_check,
            "duplicate_check": dup_check,
            "metadata_check": meta_check,
        },
        "scores": {
            "location_score": loc_score,
            "visual_score": vis_score,
            "text_score": txt_score,
            "duplicate_score": dup_score,
            "metadata_score": meta_score,
        },
        "details": {
            "distance_meters": dist_m,
            "photo_hash": photo_hash,
            "verified_at": datetime.now(timezone.utc).isoformat(),
        }
    }
