insert into dealer (id, name, city, timezone, open_time, close_time) values
    ('GB-BLR-IND', 'Gearbay Indiranagar', 'Bengaluru', 'Asia/Kolkata', '09:00', '18:00'),
    ('GB-BLR-WHF', 'Gearbay Whitefield',  'Bengaluru', 'Asia/Kolkata', '09:00', '19:00');

-- Indiranagar is car-heavy; Whitefield sees more two-wheelers.
insert into service_bay (id, dealer_id, name, vehicle_type) values
    (1,  'GB-BLR-IND', 'Car Lift 1',   'CAR'),
    (2,  'GB-BLR-IND', 'Car Lift 2',   'CAR'),
    (3,  'GB-BLR-IND', 'Car Lift 3',   'CAR'),
    (4,  'GB-BLR-IND', 'Bike Stand 1', 'BIKE'),
    (5,  'GB-BLR-IND', 'Bike Stand 2', 'BIKE'),
    (6,  'GB-BLR-WHF', 'Car Lift 1',   'CAR'),
    (7,  'GB-BLR-WHF', 'Car Lift 2',   'CAR'),
    (8,  'GB-BLR-WHF', 'Bike Stand 1', 'BIKE'),
    (9,  'GB-BLR-WHF', 'Bike Stand 2', 'BIKE'),
    (10, 'GB-BLR-WHF', 'Bike Stand 3', 'BIKE'),
    (11, 'GB-BLR-WHF', 'Bike Stand 4', 'BIKE');
