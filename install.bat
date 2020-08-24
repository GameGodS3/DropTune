pip install -r requirements.txt
python addip.py
echo start /max http://localhost:6969 > launch.bat
echo python manage.py runserver 0.0.0.0:6969 >> launch.bat
del install.bat