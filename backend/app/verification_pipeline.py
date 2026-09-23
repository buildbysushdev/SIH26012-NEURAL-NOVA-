"""
AI Evidence Cross-Verification System for Citizen Reports
MPLADS Risk Intelligence System — SIH26102, Team Neural Nova
Modular backend/app copy.
"""
import sys
import os

# Delegate directly to root verification_pipeline to maintain single source of truth
root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from verification_pipeline import *  # noqa: F401, F403
