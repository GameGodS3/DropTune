pip install -r requirements.txt
echo start /max http://localhost:8000 > launch.bat
echo python manage.py runserver >> launch.bat
del install.bat