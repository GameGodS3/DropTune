echo "Installing requirements..."
echo
pip3 install -r requirements.txt --user
echo
echo "Running manager.py migrate.."
echo
python3 manage.py migrate
python3 addip.py
browser=$(basename -s .desktop $(xdg-settings get default-web-browser))
if [[ -z $browser ]];then
    browser=$(echo $BROWSER)
fi
if [[ -z $browser ]];then
    browser="firefox"
fi
echo "echo " > launch.sh
echo "ippaddr=$(ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1')" >> launch.sh
echo 'echo "Open $ippaddr:6969 in another device and enjoy" ' >> launch.sh
echo "echo " >> launch.sh
echo "$browser http://0.0.0.0:6969" >> launch.sh 
echo "python3 manage.py runserver 0.0.0.0:6969" >> launch.sh 

echo "Installation completed successfull!"
echo "run ./launch.sh to launch the app"
chmod +x launch.sh 
