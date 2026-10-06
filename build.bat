@echo off
setlocal
python -m pip install -r requirements-dev.txt
pyinstaller --noconfirm --clean --windowed --onefile --name "Ditasha-FiveM-Sorting" --collect-all szio --collect-all pymateria --collect-all pyopengltk --collect-all OpenGL app.py
if errorlevel 1 exit /b 1
echo.
echo Build selesai: dist\Ditasha-FiveM-Sorting.exe
