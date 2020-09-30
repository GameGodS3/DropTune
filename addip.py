import os
import droptune.settings as lst
import socket

os.chdir(os.path.dirname(os.path.abspath(__file__)))

s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.connect(("8.8.8.8", 80))
ip = str(s.getsockname()[0])
s.close()

lst.ALLOWED_HOSTS.append('" + ip + "')