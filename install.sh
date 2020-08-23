pip3 install -r requirements.txt
echo firefox http://0.0.0.0:8000 > launch.sh 
echo python3 manage.py runserver >> launch.sh 
chmod +x ./launch.sh && rm install.sh