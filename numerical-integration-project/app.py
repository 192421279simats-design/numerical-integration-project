
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import numpy as np
import os

app = Flask(__name__)
CORS(app)

# Project directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


# ==========================================
# FRONTEND ROUTES
# ==========================================

@app.route('/')
def home():
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/style.css')
def styles():
    return send_from_directory(BASE_DIR, 'style.css')


@app.route('/script.js')
def scripts():
    return send_from_directory(BASE_DIR, 'script.js')


# ==========================================
# NUMERICAL INTEGRATION METHODS
# ==========================================

def trapezoidal_rule(y_values, h=1.0):
    """
    Composite Trapezoidal Rule:
    Integral = h/2 * [y0 + 2y1 + 2y2 + ... + yn]
    """

    n = len(y_values)

    if n < 2:
        return 0.0

    result = y_values[0] + y_values[-1]
    result += 2 * sum(y_values[1:-1])

    return (h / 2) * result


def simpsons_rule(y_values, h=1.0):
    """
    Composite Simpson's 1/3 Rule.
    Requires an even number of intervals.
    """

    n = len(y_values)

    if n < 3:
        return trapezoidal_rule(y_values, h)

    # Handle odd number of intervals
    if (n - 1) % 2 != 0:
        s = simpsons_rule(y_values[:-1], h)
        s += (h / 2) * (y_values[-2] + y_values[-1])
        return s

    result = y_values[0] + y_values[-1]

    for i in range(1, n - 1):
        if i % 2 == 0:
            result += 2 * y_values[i]
        else:
            result += 4 * y_values[i]

    return (h / 3) * result


# ==========================================
# INTEGRATION API
# ==========================================

@app.route('/integrate', methods=['POST'])
def integrate():

    try:
        data = request.get_json()

        if not data or 'values' not in data:
            return jsonify({
                'error': 'Missing "values" field in request body'
            }), 400

        raw = data['values']

        # Accept list or comma-separated string
        if isinstance(raw, str):
            values = [
                float(x.strip())
                for x in raw.split(',')
                if x.strip()
            ]

        elif isinstance(raw, list):
            values = [float(x) for x in raw]

        else:
            return jsonify({
                'error': 'Invalid format for "values"'
            }), 400

        if len(values) < 2:
            return jsonify({
                'error': 'At least 2 data points are required'
            }), 400

        h = float(data.get('step', 1.0))
        module = data.get('module', 'generic')

        if not np.isfinite(h) or h <= 0:
            return jsonify({
                'error': 'Step size must be a positive finite number'
            }), 400

        if not all(np.isfinite(v) for v in values):
            return jsonify({
                'error': 'All input values must be finite numbers'
            }), 400

        # Calculate integration
        trap_result = trapezoidal_rule(values, h)
        simp_result = simpsons_rule(values, h)

        # Calculate cumulative area
        cumulative = [0.0]

        for i in range(1, len(values)):
            area = (h / 2) * (
                values[i - 1] + values[i]
            )

            cumulative.append(cumulative[-1] + area)

        # Return results
        return jsonify({

            'module': module,

            'input_values': values,

            'step_size': h,

            'n_intervals': len(values) - 1,

            'trapezoidal': round(trap_result, 6),

            'simpsons': round(simp_result, 6),

            'cumulative': [
                round(c, 4) for c in cumulative
            ],

            'mean_value': round(float(np.mean(values)), 4),

            'max_value': round(float(np.max(values)), 4),

            'min_value': round(float(np.min(values)), 4)

        })

    except (ValueError, TypeError) as e:

        return jsonify({
            'error': f'Invalid numeric value: {str(e)}'
        }), 400

    except Exception as e:

        return jsonify({
            'error': f'Server error: {str(e)}'
        }), 500


# ==========================================
# HEALTH CHECK API
# ==========================================

@app.route('/health', methods=['GET'])
def health():

    return jsonify({
        'status': 'ok',
        'message': 'Numerical Integration API is running'
    })


# ==========================================
# RUN APPLICATION
# ==========================================

if __name__ == '__main__':

    app.run(
        debug=True,
        host='127.0.0.1',
        port=5000
    )
