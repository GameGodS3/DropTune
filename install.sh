pip3 install -r requirements.txt
python3 manage.py migrate
echo firefox http://127.0.0.1:8000 > launch.sh 
echo python3 manage.py runserver >> launch.sh 
chmod +x ./launch.sh && rm install.sh