pip3 install -r requirements.txt
python3 manage.py migrate
python3 addip.py
echo firefox http://0.0.0.0:6969 > launch.sh 
echo python3 manage.py runserver 0.0.0.0:6969 >> launch.sh 
chmod +x ./launch.sh && rm install.sh