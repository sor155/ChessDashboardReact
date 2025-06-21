from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/api/ping')
def ping():
    return jsonify({'ping': 'pong'})

if __name__ == '__main__':
    # for local dev—Docker will use gunicorn
    app.run(host='0.0.0.0', port=5000, debug=True)