-- A booking can now combine several services (e.g. general service + brake service), done back to back
-- on one bay. Existing single-service bookings become one-element lists.
alter table appointment add column service_types varchar(32)[];
update appointment set service_types = array[service_type];
alter table appointment alter column service_types set not null;
alter table appointment add constraint ck_appointment_service_types
    check (cardinality(service_types) between 1 and 5);
alter table appointment drop column service_type;
