#!/usr/bin/env python3
"""
Generate correct DttWeeklySession.new() calls based on type definition.
This script parses the type definition and generates the exact parameter list needed.
"""

import re

def parse_type_definition(pine_file_path):
    """Parse the DttWeeklySession type definition from the Pine script."""
    with open(pine_file_path, 'r') as f:
        lines = f.readlines()

    # Find type definition
    in_type = False
    fields = []

    for i, line in enumerate(lines):
        stripped = line.strip()

        if stripped == 'type DttWeeklySession':
            in_type = True
            continue

        if in_type:
            # Check if we've reached the end of the type
            if stripped and not stripped.startswith('//') and not any(c in stripped for c in ['int ', 'float ', 'string ', 'bool ', 'line ', 'box ', 'label ']):
                break

            # Skip comments and empty lines
            if not stripped or stripped.startswith('//'):
                continue

            # Parse field
            if '=' in stripped:
                field_part = stripped.split('=')[0].strip()
                default_part = stripped.split('=')[1].strip()
                parts = field_part.split()
                if len(parts) == 2:
                    field_type, field_name = parts
                    fields.append({
                        'position': len(fields) + 1,
                        'name': field_name,
                        'type': field_type,
                        'has_default': True,
                        'default_value': default_part
                    })
            else:
                parts = stripped.split()
                if len(parts) == 2:
                    field_type, field_name = parts
                    fields.append({
                        'position': len(fields) + 1,
                        'name': field_name,
                        'type': field_type,
                        'has_default': False,
                        'default_value': None
                    })

    return fields

def generate_new_call_template(fields):
    """Generate a template showing exactly which parameters map to which fields."""
    params_to_pass = [f for f in fields if not f['has_default']]

    print(f"\n{'='*80}")
    print(f"DttWeeklySession Type Analysis")
    print(f"{'='*80}")
    print(f"\nTotal fields: {len(fields)}")
    print(f"Fields with defaults (SKIP): {len([f for f in fields if f['has_default']])}")
    print(f"Parameters to pass: {len(params_to_pass)}")

    print(f"\n{'='*80}")
    print(f"Fields WITH Defaults (DO NOT PASS AS PARAMETERS)")
    print(f"{'='*80}")
    for f in fields:
        if f['has_default']:
            print(f"  Position {f['position']:2d}: {f['name']:30s} = {f['default_value']}")

    print(f"\n{'='*80}")
    print(f"Parameter Order (Fields WITHOUT Defaults)")
    print(f"{'='*80}")

    param_num = 1
    for f in fields:
        if not f['has_default']:
            print(f"  Param {param_num:2d} -> Field {f['position']:2d}: {f['name']:30s} ({f['type']})")
            param_num += 1

    return params_to_pass

def generate_template_call(fields):
    """Generate template initialization (constants + na values)."""
    params_to_pass = [f for f in fields if not f['has_default']]

    # First 13 parameters are constants (name through interval3_day)
    constants = []
    for i in range(13):
        if i < len(params_to_pass):
            f = params_to_pass[i]
            if i == 0:  # name
                constants.append(f"SESSION_NAME")
            elif 'time' in f['name'].lower():
                constants.append(f"TIME_CONST")
            elif 'day' in f['name'].lower():
                constants.append(f"DAY_CONST")

    # Rest are na
    na_count = len(params_to_pass) - 13
    na_values = ['na'] * na_count

    all_params = constants + na_values

    print(f"\n{'='*80}")
    print(f"TEMPLATE Initialization Pattern")
    print(f"{'='*80}")
    print(f"DttWeeklySession.new(")
    for i, param in enumerate(all_params[:20], 1):  # Show first 20
        print(f"    {param},  // P{i}")
    print(f"    ... ({len(all_params) - 20} more parameters)")
    print(f")")
    print(f"\nTotal parameters: {len(all_params)}")
    print(f"Comma count: {len(all_params) - 1}")

    return ', '.join(all_params)

def generate_empty_call(fields):
    """Generate empty session (na/0 values)."""
    params_to_pass = [f for f in fields if not f['has_default']]

    params = []
    for f in params_to_pass:
        if f['type'] == 'int':
            params.append('0')
        elif f['type'] == 'string':
            params.append('na')
        else:
            params.append('na')

    print(f"\n{'='*80}")
    print(f"EMPTY Session Pattern (for get_previous_session)")
    print(f"{'='*80}")
    print(f"DttWeeklySession.new(")
    for i, param in enumerate(params[:20], 1):  # Show first 20
        field = params_to_pass[i-1]
        print(f"    {param},  // P{i}: {field['name']} ({field['type']})")
    print(f"    ... ({len(params) - 20} more parameters)")
    print(f")")
    print(f"\nTotal parameters: {len(params)}")
    print(f"Comma count: {len(params) - 1}")

    return ', '.join(params)

def generate_actual_call(fields, line_num):
    """Generate the actual .new() call string."""
    params_to_pass = [f for f in fields if not f['has_default']]

    if line_num == 348:  # Template
        # SESSION_ISCARIOT, TIME_ISCARIOT_START, etc. (13 constants) + rest na
        params = [
            'SESSION_ISCARIOT', 'TIME_ISCARIOT_START', 'DAY_ISCARIOT_START',
            'TIME_ISCARIOT_END', 'DAY_ISCARIOT_END', 'TIME_ISCARIOT_ROOT',
            'DAY_ISCARIOT_ROOT', 'TIME_ISCARIOT_INTERVAL1', 'DAY_ISCARIOT_INTERVAL1',
            'TIME_ISCARIOT_INTERVAL2', 'DAY_ISCARIOT_INTERVAL2',
            'TIME_ISCARIOT_INTERVAL3', 'DAY_ISCARIOT_INTERVAL3'
        ]
        params += ['na'] * (len(params_to_pass) - 13)

    elif line_num == 497:  # get_previous_session
        params = []
        for f in params_to_pass:
            if f['type'] == 'int':
                params.append('0')
            else:
                params.append('na')

    elif line_num == 645:  # new_session creation
        # Mix of template values and calculated values
        params = [
            'template.name', 'template.start_time', 'template.start_day',
            'template.end_time', 'template.end_day', 'template.root_time',
            'template.root_day', 'template.interval1_time', 'template.interval1_day',
            'template.interval2_time', 'template.interval2_day',
            'template.interval3_time', 'template.interval3_day',
            'bar_index', 'na', 'calculated_start_timestamp', 'calculated_end_timestamp'
        ]
        params += ['na'] * (len(params_to_pass) - 17)

    elif line_num == 1036:  # next_sess lookup
        params = []
        for f in params_to_pass:
            if f['type'] == 'int':
                params.append('0')
            else:
                params.append('na')
    else:
        # Default: all na/0
        params = []
        for f in params_to_pass:
            if f['type'] == 'int':
                params.append('0')
            else:
                params.append('na')

    return 'DttWeeklySession.new(' + ', '.join(params) + ')'

if __name__ == '__main__':
    pine_file = '/Users/kaschief/Desktop/indicators-by-kash/indicators/11-dtt-intraday/code/development/kash-dtt-weekly-pro.pine'

    fields = parse_type_definition(pine_file)
    params_to_pass = generate_new_call_template(fields)

    # Generate patterns
    generate_template_call(fields)
    generate_empty_call(fields)

    # Generate actual calls for each line
    print(f"\n{'='*80}")
    print(f"ACTUAL .new() CALLS FOR EACH LINE")
    print(f"{'='*80}")

    for line_num in [348, 349, 350, 351, 497, 645, 1036]:
        call = generate_actual_call(fields, line_num)
        print(f"\nLine {line_num}:")
        print(call[:150] + "..." if len(call) > 150 else call)

        # Count parameters
        param_count = call.count(',') + 1
        print(f"Parameter count: {param_count}")

        if param_count != len(params_to_pass):
            print(f"⚠️  ERROR: Expected {len(params_to_pass)} parameters, got {param_count}")
        else:
            print(f"✓ Correct parameter count")
