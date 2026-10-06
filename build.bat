@echo off
setlocal
python -m pip install -r requirements-dev.txt
pyinstaller --noconfirm --clean --windowed --onefile --name "Ditasha-FiveM-Sorting" app.py
if errorlevel 1 exit /b 1
echo.
echo Build selesai: dist\Ditasha-FiveM-Sorting.exe
