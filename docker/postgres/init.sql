-- One Postgres container, one database per service: services never share tables.
create database appointment_db;
create database repair_order_db;
create database inventory_db;
create database notification_db;
