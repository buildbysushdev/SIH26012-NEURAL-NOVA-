@echo off
title Deploy to Vercel (SIH 2026 - Team Neural Nova)
echo ======================================================================
echo  MPLADS Risk Intelligence System — Vercel Deployment
echo  Target: https://sih26102neuralnovasih.vercel.app
echo ======================================================================
echo.
echo Running production deployment to existing linked project...
echo.
npx --yes vercel --prod
echo.
echo Deployment finished!
pause
