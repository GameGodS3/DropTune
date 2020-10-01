def qrgen():
    import pyqrcode
    import png
    import socket
    import base64
    import os

    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(("8.8.8.8", 80))
    ip = s.getsockname()[0]
    s.close()
    ip = "http://" + str(ip) + ":6969"
    url = pyqrcode.create(ip) 
    url.png('code.png', scale = 6) 
    
    with open('code.png', 'rb') as f:
        usrimgbin = f.read()
        usrimg64 = str(base64.b64encode(usrimgbin))[2:-3]
    
    os.remove('code.png')
    return usrimg64, ip
qrgen()