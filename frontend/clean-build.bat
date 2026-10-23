@echo off
REM Clean build script for Next.js frontend

echo Cleaning Next.js cache...
if exist .next rmdir /s /q .next
if exist node_modules\.cache rmdir /s /q node_modules\.cache
if exist .tsbuildinfo del /q .tsbuildinfo

echo Cache cleaned
echo.
echo Running build...
npm run build