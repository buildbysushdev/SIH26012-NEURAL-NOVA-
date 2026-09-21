"""
Consolidated Project Analysis & Audit Brief Dossier for MPLADS Risk Intelligence System.
Generates an official, publication-grade 2-page supervisory audit brief & on-site inspection
dossier using ReportLab:
- Page 1: Administrative Profile, Priority Risk Score, Sentinel-2 Aerial Satellite Panel,
          and "What's the Doubt?" Gemini Anomaly Synthesis.
- Page 2: On-Site Physical Verification Checklist (DISHA inspection protocol with sign-off),
          Citizen Grievance History with photo evidence, 4-Signal Algorithmic Fusion Matrix,
          and Statutory Decision-Support Footer.
"""
import io
import os
import re
import html
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException, Query, status, Response

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    PageBreak,
    Image as RLImage,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY

from explain_gemini import explain_flagged_project, synthesize_audit_doubts
from satellite_check import generate_satellite_thumbnail, geocode_district
from citizen_reports import get_citizen_reports

router = APIRouter(tags=["Audit Brief & Project Analysis"])

# Global in-memory reference to main dataframe (set at server startup)
_MAIN_DF_REF: Optional[pd.DataFrame] = None


def set_main_dataframe_reference(df: pd.DataFrame):
    """Sets reference to in-memory project dataframe for audit dossier generation."""
    global _MAIN_DF_REF
    _MAIN_DF_REF = df


def format_inr(amount: Optional[float]) -> str:
    """Formats numeric amount into Indian Currency notation (Rs. Lakhs/Crores)."""
    if amount is None or pd.isna(amount):
        return "N/A"
    try:
        amt = float(amount)
        if amt >= 10000000:
            return f"Rs. {amt / 10000000:.2f} Cr (Rs. {amt:,.0f})"
        elif amt >= 100000:
            return f"Rs. {amt / 100000:.2f} Lakh (Rs. {amt:,.0f})"
        else:
            return f"Rs. {amt:,.0f}"
    except Exception:
        return str(amount)


def _esc(val: Any) -> str:
    """Escapes XML/HTML special characters for ReportLab Paragraphs."""
    if val is None or pd.isna(val):
        return "N/A"
    return html.escape(str(val))


def generate_audit_brief_pdf(
    project: Dict[str, Any],
    explanation: Optional[str] = None,
    doubt_data: Optional[Dict[str, Any]] = None,
    language: str = "English"
) -> bytes:
    """
    Builds an official 2-page consolidated project analysis and physical verification dossier.
    Page 1: Administrative snapshot, Satellite aerial analysis, 'What is the Doubt?' AI synthesis.
    Page 2: Physical verification checklist, Citizen grievances, 4-signal score breakdown, Statutory sign-off.
    """
    # 1. Synthesize explanation and structured doubts if not provided
    if not explanation:
        explanation = explain_flagged_project(project, language=language)
    if not doubt_data:
        doubt_data = synthesize_audit_doubts(project, language=language)

    buffer = io.BytesIO()
    # A4 dimensions: 595.28 x 841.89 pt. Printable width with 26pt margins = 543 pt.
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=26,
        rightMargin=26,
        topMargin=20,
        bottomMargin=20,
    )

    styles = getSampleStyleSheet()

    # Typography styles
    hdr_super = ParagraphStyle(
        "HdrSuper",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#1A365D"),
        alignment=TA_CENTER,
    )
    hdr_title = ParagraphStyle(
        "HdrTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=14.5,
        textColor=colors.HexColor("#0F172A"),
        alignment=TA_CENTER,
    )
    hdr_sub = ParagraphStyle(
        "HdrSub",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#DC2626"),
        alignment=TA_CENTER,
    )

    lbl_style = ParagraphStyle(
        "FieldLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=8.5,
        textColor=colors.HexColor("#334155"),
    )
    val_style = ParagraphStyle(
        "FieldValue",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7,
        leading=8.5,
        textColor=colors.HexColor("#0F172A"),
    )
    val_bold = ParagraphStyle(
        "FieldValueBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=8.5,
        textColor=colors.HexColor("#0F172A"),
    )
    section_title = ParagraphStyle(
        "SectionTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1E3A8A"),
    )
    doubt_item = ParagraphStyle(
        "DoubtItem",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#1E293B"),
    )
    doubt_focus = ParagraphStyle(
        "DoubtFocus",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#991B1B"),
    )
    check_item = ParagraphStyle(
        "CheckItem",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#0F172A"),
    )
    footer_style = ParagraphStyle(
        "FooterNotice",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=6.5,
        leading=8,
        textColor=colors.HexColor("#64748B"),
        alignment=TA_CENTER,
    )

    story = []
    page_width = 543

    # =========================================================================
    # PAGE 1: SUPERVISORY RISK PROFILE, SATELLITE EVIDENCE & "WHAT'S THE DOUBT?"
    # =========================================================================

    # 1. Government Header Banner
    story.append(Paragraph("GOVERNMENT OF INDIA &bull; MINISTRY OF STATISTICS & PROGRAMME IMPLEMENTATION", hdr_super))
    story.append(Paragraph("MPLAD Scheme &bull; Risk Intelligence Decision Support System (SIH26102)", hdr_title))
    story.append(Paragraph("CONFIDENTIAL &bull; CONSOLIDATED PROJECT ANALYSIS & SITE INSPECTION DOSSIER", hdr_sub))
    story.append(Spacer(1, 3))
    story.append(HRFlowable(width="100%", thickness=1.2, color=colors.HexColor("#1E3A8A"), spaceAfter=4))

    # 2. Executive Priority & Composite Risk Score Card
    risk_score = float(project.get("risk_score") or 0.0)
    if risk_score >= 75.0:
        priority_label = "HIGH SUPERVISORY PRIORITY"
        priority_bg = colors.HexColor("#FEE2E2")
        priority_fg = colors.HexColor("#991B1B")
    elif risk_score >= 50.0:
        priority_label = "MODERATE SUPERVISORY PRIORITY"
        priority_bg = colors.HexColor("#FEF3C7")
        priority_fg = colors.HexColor("#92400E")
    else:
        priority_label = "ROUTINE AUDIT PRIORITY"
        priority_bg = colors.HexColor("#E0E7FF")
        priority_fg = colors.HexColor("#1E40AF")

    zscore_val = project.get("cost_zscore")
    zscore_str = f"{float(zscore_val):.2f}" if (zscore_val is not None and not pd.isna(zscore_val)) else "0.00"
    cost_score = float(project.get("cost_risk_score") or 0.0)
    nlp_score = float(project.get("nlp_similarity_score") or 0.0)
    sat_status = str(project.get("satellite_status") or "no_imagery").replace("_", " ").upper()
    citizen_count = int(project.get("citizen_report_count") or 0)

    score_card_data = [
        [
            Paragraph(
                f"<b>COMPOSITE RISK SCORE</b><br/>"
                f"<font size='16' color='{priority_fg.hexval()}'><b>{risk_score:.1f} / 100</b></font><br/>"
                f"<b>{priority_label}</b>",
                ParagraphStyle("RiskScoreVal", parent=styles["Normal"], alignment=TA_CENTER, leading=14)
            ),
            Paragraph(
                f"<b>MULTI-SIGNAL SUPERVISORY TRIANGULATION:</b><br/>"
                f"&bull; <b>Cost Anomaly Engine:</b> Score: {cost_score:.1f}/100 (Deviation: {zscore_str} std dev from category median)<br/>"
                f"&bull; <b>NLP Semantic Duplicate:</b> Score: {nlp_score:.1f}/100 (Cluster Match: {_esc(project.get('similar_project') or 'None')})<br/>"
                f"&bull; <b>Copernicus Sentinel-2 Check:</b> Physical Status: <b>{sat_status}</b><br/>"
                f"&bull; <b>Citizen Grievance Feed:</b> <b>{citizen_count} Verified Report(s) Registered on Scheme Portal</b>",
                ParagraphStyle("SignalsVal", parent=styles["Normal"], fontSize=7.5, leading=10, textColor=colors.HexColor("#0F172A"))
            )
        ]
    ]

    score_table = Table(score_card_data, colWidths=[150, page_width - 150])
    score_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), priority_bg),
        ("BACKGROUND", (1, 0), (1, 0), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(score_table)
    story.append(Spacer(1, 4))

    # 3. Project Identification & Administrative Profile Table
    details_data = [
        [
            Paragraph("Work ID:", lbl_style),
            Paragraph(f"<b>{_esc(project.get('work_id'))}</b>", val_bold),
            Paragraph("Work Status:", lbl_style),
            Paragraph(_esc(project.get("work_status")), val_style),
        ],
        [
            Paragraph("State:", lbl_style),
            Paragraph(_esc(project.get("state")), val_style),
            Paragraph("Constituency / District:", lbl_style),
            Paragraph(_esc(project.get("constituency")), val_style),
        ],
        [
            Paragraph("Hon'ble MP:", lbl_style),
            Paragraph(_esc(project.get("mp_name")), val_style),
            Paragraph("Parliamentary Chamber:", lbl_style),
            Paragraph(_esc(project.get("chamber")), val_style),
        ],
        [
            Paragraph("Sanction Amount:", lbl_style),
            Paragraph(f"<b>{_esc(format_inr(project.get('sanction_amount')))}</b>", val_bold),
            Paragraph("Expenditure / Released:", lbl_style),
            Paragraph(_esc(format_inr(project.get("expenditure_amount") or project.get("sanction_amount"))), val_style),
        ],
        [
            Paragraph("Work Category:", lbl_style),
            Paragraph(_esc(project.get("work_category")), val_style),
            Paragraph("Sanction Date:", lbl_style),
            Paragraph(_esc(project.get("sanction_date") or project.get("recommended_date")), val_style),
        ],
        [
            Paragraph("Implementing Agency (IDA):", lbl_style),
            Paragraph(_esc(project.get("ida")), val_style),
            Paragraph("Allocated Contractor / Vendor:", lbl_style),
            Paragraph(_esc(project.get("vendor_name") or "Direct Allocation / Not Declared"), val_style),
        ],
        [
            Paragraph("Work Description:", lbl_style),
            Paragraph(_esc(project.get("work_description")), val_style),
            Paragraph("", lbl_style),
            Paragraph("", val_style),
        ]
    ]

    details_table = Table(details_data, colWidths=[95, 175, 95, page_width - 365])
    details_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F1F5F9")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F1F5F9")),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#94A3B8")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
        ("SPAN", (1, 6), (3, 6)),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(details_table)
    story.append(Spacer(1, 4))

    # 4. Satellite Verification Panel with Embedded Aerial Imagery
    district = str(project.get("constituency") or project.get("ida") or "vaishali").strip()
    state = str(project.get("state") or "bihar").strip()
    sat_stat_raw = str(project.get("satellite_status") or "no_imagery").lower()
    coords = geocode_district(district, state, allow_network=False) or (25.0, 85.0)

    sat_thumb_buf = generate_satellite_thumbnail(
        district=district,
        state=state,
        status=sat_stat_raw,
        coordinates=coords,
        width=543,
        height=100
    )
    story.append(RLImage(sat_thumb_buf, width=page_width, height=96))

    sat_caption_text = (
        f"<b>Sentinel-2 Spatial Resolution:</b> 10m/pixel &bull; <b>Observation Verdict:</b> "
        f"{'No structural spectral delta detected at target centroid; physical ground verification advised.' if sat_stat_raw == 'not_visible' else 'Spectral signature consistent with physical site presence.'} "
        f"<i>(Note: Optical analysis subject to regional cloud fraction and high-altitude tree canopy).</i>"
    )
    sat_caption = Paragraph(sat_caption_text, ParagraphStyle("SatCaption", parent=styles["Normal"], fontSize=6.5, leading=8.5, textColor=colors.HexColor("#475569")))
    story.append(Spacer(1, 2))
    story.append(sat_caption)
    story.append(Spacer(1, 4))

    # 5. "What is the Doubt?" Section (Auditor Focus & Red Flags)
    doubt_bullets = doubt_data.get("doubts", [])
    doubt_summary = doubt_data.get("summary", explanation)
    auditor_focus = doubt_data.get("auditor_focus", "Perform physical ground survey and verify procurement delivery receipts.")

    doubts_rendered = [Paragraph(f"<b>SUPERVISORY AUDIT SYNTHESIS:</b> \"{_esc(doubt_summary)}\"", ParagraphStyle("DoubtSumm", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7.5, leading=9.5, textColor=colors.HexColor("#1E3A8A")))]
    doubts_rendered.append(Spacer(1, 2))
    for d in doubt_bullets[:4]:
        doubts_rendered.append(Paragraph(f"&bull; {_esc(d)}", doubt_item))
    doubts_rendered.append(Spacer(1, 2))
    doubts_rendered.append(Paragraph(f"<b>PRIORITY ON-SITE INSPECTION TARGET:</b> {_esc(auditor_focus)}", doubt_focus))

    doubt_box = Table([[doubts_rendered]], colWidths=[page_width])
    doubt_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FEF3C7")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#D97706")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(doubt_box)
    story.append(Spacer(1, 4))

    # Page 1 Footer indicator
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    p1_footer = f"Dossier ID: AUD-{str(project.get('work_id', 'REF')).replace('/', '-')[:26]} &bull; Generated: {now_str} &bull; Page 1 of 2 (Turn over for Physical Inspection Protocol)"
    story.append(Paragraph(p1_footer, footer_style))

    # =========================================================================
    # PAGE 2: FIELD VERIFICATION PROTOCOL, CITIZEN EVIDENCE & AUDIT TRAIL
    # =========================================================================
    story.append(PageBreak())

    # Page 2 Header
    story.append(Paragraph("GOVERNMENT OF INDIA &bull; FIELD VIGILANCE PROTOCOL & VERIFICATION CHECKLIST", hdr_super))
    story.append(Paragraph(f"PHYSICAL SITE INSPECTION PROTOCOL &bull; WORK ID: {_esc(project.get('work_id'))}", hdr_title))
    story.append(HRFlowable(width="100%", thickness=1.2, color=colors.HexColor("#1E3A8A"), spaceAfter=5))

    # 1. Mandatory On-Site Physical Verification Checklist (DISHA)
    checklist_data = [
        [
            Paragraph("<b>#</b>", lbl_style),
            Paragraph("<b>Physical Inspection Check Item</b>", lbl_style),
            Paragraph("<b>Verification Standard</b>", lbl_style),
            Paragraph("<b>Finding (Tick)</b>", ParagraphStyle("TickHdr", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7, alignment=TA_CENTER)),
        ],
        [
            Paragraph("1", val_bold),
            Paragraph("<b>Physical Existence at Coordinates</b>", check_item),
            Paragraph(f"Verify asset/civil work exists on ground at declared site ({coords[0]:.4f}&deg;N, {coords[1]:.4f}&deg;E).", check_item),
            Paragraph("[  ] Exists<br/>[  ] Missing", check_item),
        ],
        [
            Paragraph("2", val_bold),
            Paragraph("<b>Technical BOQ Specifications</b>", check_item),
            Paragraph("Physical dimensions, material quality, and quantities match approved sanction estimates and Measurement Book.", check_item),
            Paragraph("[  ] Compliant<br/>[  ] Deviation", check_item),
        ],
        [
            Paragraph("3", val_bold),
            Paragraph("<b>Non-Duplication Confirmation</b>", check_item),
            Paragraph(f"Verify asset is not simultaneously billed under partner sanction ({_esc(project.get('similar_project') or 'N/A')}) or state schemes.", check_item),
            Paragraph("[  ] Distinct<br/>[  ] Duplicate", check_item),
        ],
        [
            Paragraph("4", val_bold),
            Paragraph("<b>Citizen Grievance In-Person Inquiry</b>", check_item),
            Paragraph("Interview local beneficiaries/residents to verify whether asset is functional and complaints resolved.", check_item),
            Paragraph("[  ] Satisfied<br/>[  ] Unresolved", check_item),
        ],
        [
            Paragraph("5", val_bold),
            Paragraph("<b>Official Scheme Inscription Plaque</b>", check_item),
            Paragraph(f"Permanent stone plaque installed bearing Hon'ble MP Name ({_esc(project.get('mp_name'))}), Sanction Amount, and MPLADS Logo.", check_item),
            Paragraph("[  ] Installed<br/>[  ] Absent", check_item),
        ],
        [
            Paragraph("6", val_bold),
            Paragraph("<b>Geo-Tagged Photographic Proof</b>", check_item),
            Paragraph("Minimum 3 high-resolution time-stamped photographs captured (front view, plaque close-up, and wide context).", check_item),
            Paragraph("[  ] Uploaded<br/>[  ] Pending", check_item),
        ]
    ]

    checklist_table = Table(checklist_data, colWidths=[20, 160, 263, 100])
    checklist_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#94A3B8")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(checklist_table)
    story.append(Spacer(1, 4))

    # 2. Inspecting Officer Sign-off Block
    sign_block_data = [
        [
            Paragraph("<b>Inspecting Vigilance Officer:</b> ___________________________", val_style),
            Paragraph("<b>Designation & Department:</b> ___________________________", val_style),
        ],
        [
            Paragraph("<b>Date of Physical Inspection:</b> ____ / ____ / 2026", val_style),
            Paragraph("<b>Site Finding:</b> [  ] Approved for Sign-off   [  ] Escalated for Audit Review", val_style),
        ],
        [
            Paragraph("<b>Officer Signature & Official Seal:</b> ____________________________________________________", val_style),
            Paragraph("", val_style),
        ]
    ]
    sign_table = Table(sign_block_data, colWidths=[271, 272])
    sign_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#CBD5E1")),
        ("SPAN", (0, 2), (1, 2)),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(sign_table)
    story.append(Spacer(1, 4))

    # 3. Citizen Grievance & Public Evidence Panel
    citizen_reports = get_citizen_reports(project.get("work_id"))
    citizen_table_rows = [
        [
            Paragraph("<b>Report ID</b>", lbl_style),
            Paragraph("<b>Filing Date</b>", lbl_style),
            Paragraph("<b>Grievance Summary & Citizen Observations</b>", lbl_style),
            Paragraph("<b>Photo Proof</b>", lbl_style),
        ]
    ]

    if citizen_reports:
        for cr in citizen_reports[:2]:  # Display up to 2 reports cleanly
            photo_file = cr.get("photo_filename")
            photo_cell = Paragraph("None attached", val_style)
            if photo_file and isinstance(photo_file, str) and not pd.isna(photo_file) and photo_file.strip():
                photo_path = Path("uploads/citizen_reports") / photo_file.strip()
                if photo_path.exists():
                    try:
                        from PIL import Image as PILImage
                        with PILImage.open(photo_path) as test_img:
                            test_img.verify()
                        photo_cell = RLImage(str(photo_path), width=50, height=36)
                    except Exception:
                        photo_cell = Paragraph("Photo on file", val_style)

            citizen_table_rows.append([
                Paragraph(_esc(cr.get("report_id")), val_bold),
                Paragraph(_esc(str(cr.get("timestamp"))[:10]), val_style),
                Paragraph(_esc(cr.get("description")), val_style),
                photo_cell
            ])
    else:
        citizen_table_rows.append([
            Paragraph("N/A", val_style),
            Paragraph("N/A", val_style),
            Paragraph("<i>No citizen grievance reports or public discrepancies filed for this Work ID.</i>", val_style),
            Paragraph("N/A", val_style),
        ])

    citizen_table = Table(citizen_table_rows, colWidths=[70, 75, 338, 60])
    citizen_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EFF6FF")),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#BFDBFE")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#DBEAFE")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(Paragraph("<b>CITIZEN GRIEVANCES & PUBLIC FIELD FEEDBACK:</b>", section_title))
    story.append(Spacer(1, 1))
    story.append(citizen_table)
    story.append(Spacer(1, 4))

    # 4. Multi-Signal Algorithmic Score Fusion Matrix
    cost_contrib = 0.4 * cost_score if project.get("satellite_risk_score") is not None else 0.5 * cost_score
    nlp_contrib = 0.3 * nlp_score if project.get("satellite_risk_score") is not None else 0.5 * nlp_score
    sat_val = float(project.get("satellite_risk_score") or 0.0)
    sat_contrib = 0.3 * sat_val if project.get("satellite_risk_score") is not None else 0.0
    boost_val = 15.0 if citizen_count > 0 else 0.0

    matrix_data = [
        [
            Paragraph("<b>Anomaly Detection Engine</b>", lbl_style),
            Paragraph("<b>Weight</b>", lbl_style),
            Paragraph("<b>Raw Score</b>", lbl_style),
            Paragraph("<b>Net Risk Contribution</b>", lbl_style),
        ],
        [
            Paragraph("<b>Cost Anomaly Engine</b> (Isolation Forest + Z-Score)", val_style),
            Paragraph("40%", val_style),
            Paragraph(f"{cost_score:.1f} / 100", val_style),
            Paragraph(f"+{cost_contrib:.1f} pts", val_bold),
        ],
        [
            Paragraph("<b>NLP Semantic Duplicate Engine</b> (SentenceTransformer)", val_style),
            Paragraph("30%", val_style),
            Paragraph(f"{nlp_score:.1f} / 100", val_style),
            Paragraph(f"+{nlp_contrib:.1f} pts", val_bold),
        ],
        [
            Paragraph("<b>Copernicus Sentinel-2 Satellite Engine</b> (Spectral Delta)", val_style),
            Paragraph("30%", val_style),
            Paragraph(f"{sat_val:.1f} / 100", val_style),
            Paragraph(f"+{sat_contrib:.1f} pts", val_bold),
        ],
        [
            Paragraph("<b>Citizen Grievance Verified Boost</b> (Portal Submissions)", val_style),
            Paragraph("Additive", val_style),
            Paragraph(f"{citizen_count} Report(s)", val_style),
            Paragraph(f"+{boost_val:.1f} pts", val_bold),
        ],
        [
            Paragraph("<b>COMBINED MULTI-SIGNAL SUPERVISORY RISK SCORE</b>", val_bold),
            Paragraph("<b>100%</b>", val_bold),
            Paragraph("<b>Fused</b>", val_bold),
            Paragraph(f"<b>{risk_score:.1f} / 100</b>", ParagraphStyle("MatFinal", parent=styles["Normal"], fontName="Helvetica-Bold", textColor=priority_fg)),
        ]
    ]

    matrix_table = Table(matrix_data, colWidths=[240, 80, 100, 123])
    matrix_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#94A3B8")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(Paragraph("<b>4-SIGNAL ALGORITHMIC RISK FUSION MATRIX:</b>", section_title))
    story.append(Spacer(1, 1))
    story.append(matrix_table)
    story.append(Spacer(1, 4))

    # 5. Statutory Disclaimer & Audit Trail Footer
    footer_text = (
        f"<b>STATUTORY DECISION-SUPPORT NOTICE:</b> This dossier is an automated supervisory risk prioritization tool generated using unsupervised "
        f"machine learning. It does NOT constitute a judicial finding, audit censure, or accusation of fraud. Designed exclusively for internal MoSPI audit scheduling &bull; "
        f"Dossier ID: AUD-{str(project.get('work_id', 'REF')).replace('/', '-')[:26]} &bull; Generated: {now_str} &bull; Page 2 of 2"
    )
    story.append(Paragraph(footer_text, footer_style))

    # Build Document
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


@router.get("/audit-brief/{work_id:path}")
def get_audit_brief_by_path(work_id: str, language: str = Query("English")):
    """
    Generates an official 2-page consolidated project analysis & physical inspection dossier.
    Accepts work_id path parameter with forward slashes (e.g. /audit-brief/WS/MP317/2024-2025/145098).
    """
    return _generate_and_return_pdf(work_id, language)


@router.get("/audit-brief")
def get_audit_brief_by_query(work_id: str = Query(...), language: str = Query("English")):
    """
    Query-parameter endpoint for generating the 2-page audit dossier:
    /audit-brief?work_id=WS/MP317/2024-2025/145098
    """
    return _generate_and_return_pdf(work_id, language)


@router.get("/project-analysis-report/{work_id:path}")
def get_project_analysis_report_by_path(work_id: str, language: str = Query("English")):
    """
    Dedicated semantic alias for the downloadable Project Analysis & Site Verification Dossier.
    """
    return _generate_and_return_pdf(work_id, language)


@router.get("/project-analysis-report")
def get_project_analysis_report_by_query(work_id: str = Query(...), language: str = Query("English")):
    """
    Query-parameter alias for the downloadable Project Analysis & Site Verification Dossier:
    /project-analysis-report?work_id=WS/MP317/2024-2025/145098
    """
    return _generate_and_return_pdf(work_id, language)


def _generate_and_return_pdf(work_id: str, language: str = "English") -> Response:
    global _MAIN_DF_REF
    if _MAIN_DF_REF is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="System dataset not initialized."
        )

    work_id = work_id.strip() if work_id else ""
    if not work_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="work_id cannot be empty."
        )

    row = _MAIN_DF_REF[_MAIN_DF_REF["work_id"] == work_id]
    if row.empty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with work_id '{work_id}' not found in MPLADS dataset."
        )

    raw = row.iloc[0].to_dict()
    project = {k: (None if pd.isna(v) else v) for k, v in raw.items()}

    # Generate explanation and structured doubts
    explanation = explain_flagged_project(project, language=language)
    doubt_data = synthesize_audit_doubts(project, language=language)

    # Build 2-page PDF
    pdf_bytes = generate_audit_brief_pdf(project, explanation=explanation, doubt_data=doubt_data, language=language)

    # Safe filename for download
    safe_name = re.sub(r"[^A-Za-z0-9_-]", "_", work_id)
    filename = f"AUDIT_DOSSIER_{safe_name}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename=\"{filename}\"",
            "Content-Length": str(len(pdf_bytes)),
        }
    )
