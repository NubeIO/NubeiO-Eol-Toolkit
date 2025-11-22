# import serial
# import time

# ser = serial.Serial(
#     port="COM7",    
#     baudrate=9600,
#     bytesize=serial.EIGHTBITS,
#     parity=serial.PARITY_NONE,
#     stopbits=serial.STOPBITS_ONE,
#     timeout=1
# )

# def send(cmd):
#     ser.write((cmd + "\n").encode())
#     time.sleep(0.1)
#     resp = ser.readline().decode().strip()
#     return resp

# print("Voltage:", send("MEAS:VOLT?"))
# print("Current:", send("MEAS:CURR?"))
# print("Output state:", send("OUTP?"))

import serial, time

ser = serial.Serial("COM7", 9600, timeout=1)

def send(cmd):
    msg = cmd + "\r\n"     # CRLF
    ser.write(msg.encode())
    time.sleep(0.2)
    resp = ser.read_all().decode(errors="ignore").strip()
    print(">>", cmd)
    print("<<", resp)
    return resp

send("*IDN?")
send("MEAS:VOLT?")
send("MEAS:CURR?")
send("OUTP?")
