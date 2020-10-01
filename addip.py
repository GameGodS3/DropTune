import os
import socket
def addip():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(("8.8.8.8", 80))
    ip = str(s.getsockname()[0])
    s.close()

    with open('droptune/settings.py', 'r') as f:
        settings = f.readlines()

    replacetxt = "ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '" + ip + "']\n"
    settings[27] = replacetxt

    with open('droptune/settings.py', 'w') as f:
        f.writelines(settings)