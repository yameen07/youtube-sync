#!/bin/bash
# Helper script to get your local IP address

echo "Your local IP address(es):"
echo "=========================="
ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print "  " $2}'
echo ""
echo "Access the app on mobile devices using:"
echo "  http://YOUR_IP:3000"
echo ""
echo "Example: http://192.168.0.102:3000"

