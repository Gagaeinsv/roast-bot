import paramiko, sys

HOST = "204.168.240.223"
USER = "root"
passwords = [
    "Nigerr13091984@",
    "Nigerr13091984",
    "nigerr13091984@",
    "Nigger13091984@",
]

for pwd in passwords:
    try:
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(HOST, username=USER, password=pwd, timeout=8)
        print("SUCCESS with password: " + pwd)
        c.close()
        sys.exit(0)
    except Exception as e:
        print("FAIL [" + pwd + "]: " + str(e))

print("None worked.")
