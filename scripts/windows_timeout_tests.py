#!/usr/bin/env python3
"""Windows-focused timeout tests for task_checkpoint.py"""

import sys
import os
import subprocess
import time

# Add scripts to path
sys.path.insert(0, 'scripts')

try:
    import psutil
except ImportError:
    print("psutil not available, skipping process verification")
    psutil = None

from task_checkpoint import _run_with_timeout


def run_test(name, cmd, timeout=0.5):
    """Run a test and verify cleanup."""
    print(f'=== {name} ===')
    
    pids_before = set()
    if psutil:
        pids_before = set(p.pid for p in psutil.process_iter())
    
    try:
        _run_with_timeout(cmd, cwd='.', timeout=timeout)
        print(f'{name}: FAIL - should have timed out')
        return False
    except subprocess.TimeoutExpired:
        pass
    except Exception as e:
        print(f'{name}: ERROR - {e}')
        return False
    
    # Wait for cleanup
    time.sleep(1)
    
    if psutil:
        pids_after = set(p.pid for p in psutil.process_iter())
        new_pids = pids_after - pids_before
        alive = 0
        for pid in new_pids:
            try:
                p = psutil.Process(pid)
                if p.status() != psutil.STATUS_ZOMBIE:
                    alive += 1
            except:
                pass
        if alive == 0:
            print(f'{name}: PASS')
            return True
        else:
            print(f'{name}: FAIL - {alive} alive')
            return False
    else:
        print(f'{name}: PASS (timeout raised, psutil not available for verification)')
        return True


def main():
    print('=== Windows Focused Security Tests ===')
    
    # Platform-specific nested session test
    if os.name == 'nt':
        nested_session_cmd = [sys.executable, '-c', '''
import subprocess
import sys
child = subprocess.Popen(
    [sys.executable, '-c', 'import time; time.sleep(100)'],
    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
)
child.wait()
''']
        nested_name = 'Nested session (Windows CREATE_NEW_PROCESS_GROUP)'
    else:
        nested_session_cmd = [sys.executable, '-c', '''
import sys
import subprocess
import time
child = subprocess.Popen(
    [sys.executable, '-c', 'import time; time.sleep(100)'],
    start_new_session=True
)
child.wait()
''']
        nested_name = 'Nested session (Linux start_new_session)'
    
    tests = [
        ('Simple timeout', [sys.executable, '-c', 'import time; time.sleep(10)']),
        ('Child in same PG', [sys.executable, '-c', '''
import sys
import subprocess
import time
child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(100)'])
child.wait()
''']),
        (nested_name, nested_session_cmd),
    ]
    
    results = []
    for name, cmd in tests:
        result = run_test(name, cmd)
        results.append((name, result))
    
    print()
    print('=== Summary ===')
    all_pass = True
    for name, result in results:
        status = 'PASS' if result else 'FAIL'
        print(f'{name}: {status}')
        if not result:
            all_pass = False
    
    if all_pass:
        print('\nAll tests PASSED')
        sys.exit(0)
    else:
        print('\nSome tests FAILED')
        sys.exit(1)


if __name__ == '__main__':
    main()
