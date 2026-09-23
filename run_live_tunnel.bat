@echo off
title MPLADS Live Cloud Tunnel (SIH 2026)
echo ======================================================================
echo  MPLADS Risk Intelligence System — Live HTTPS Cloud Tunnel
echo  Team Neural Nova (SIH26102)
echo ======================================================================
echo.
echo Starting secure HTTPS tunnel on port 8000...
echo Connecting to: https://mplads-neural-nova-26102.loca.lt
echo.
echo NOTE: Keep this window open during live hackathon demos!
echo.
npx --yes localtunnel --port 8000 --subdomain mplads-neural-nova-26102
pause
