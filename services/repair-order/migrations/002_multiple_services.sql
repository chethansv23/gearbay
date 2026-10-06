-- A job card can cover several services from one booking; labour is charged per service.
alter table repair_order add column service_types varchar(32)[];
update repair_order set service_types = array[service_type];
alter table repair_order alter column service_types set not null;
alter table repair_order drop column service_type;
