import re

with open('/Users/amalchand/Desktop/kurickaldevelopers/mobile_app/lib/data/repositories/attendance_repository.dart', 'r') as f:
    content = f.read()

content = re.sub(
    r"'check_out_lat': location\.latitude, 'check_out_lng': location\.longitude,'lat': location\.latitude, 'lng': location\.longitude\},",
    r"'check_out_lat': location.latitude, 'check_out_lng': location.longitude,",
    content
)

content = re.sub(
    r"'check_out_location': null,",
    r"'check_out_lat': null,\n          'check_out_lng': null,",
    content
)

content = re.sub(
    r"'auto_checkout': true,",
    r"",
    content
)

content = re.sub(
    r"'auto_checkout': null,",
    r"",
    content
)

with open('/Users/amalchand/Desktop/kurickaldevelopers/mobile_app/lib/data/repositories/attendance_repository.dart', 'w') as f:
    f.write(content)
