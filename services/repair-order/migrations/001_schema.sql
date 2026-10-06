create sequence ro_number_seq start with 1001;

create table repair_order (
    id              uuid primary key,
    ro_number       varchar(20)   not null unique,
    appointment_id  uuid          not null unique,
    dealer_id       varchar(32)   not null,
    customer_name   varchar(120)  not null,
    customer_phone  varchar(20)   not null,
    vehicle_type    varchar(8)    not null,
    vehicle_number  varchar(20)   not null,
    vehicle_make    varchar(40),
    vehicle_model   varchar(60),
    service_type    varchar(32)   not null,
    odometer_km     integer,
    status          varchar(16)   not null,
    technician      varchar(80),
    note            varchar(500),
    labour_amount   numeric(12, 2) not null,
    parts_amount    numeric(12, 2),
    tax_amount      numeric(12, 2),
    total_amount    numeric(12, 2),
    opened_at       timestamptz   not null,
    closed_at       timestamptz,
    version         bigint        not null
);
create index ix_repair_order_dealer_status on repair_order (dealer_id, status, opened_at desc);

create table part_line (
    id              uuid primary key,
    repair_order_id uuid          not null references repair_order (id),
    request_id      uuid          not null,
    sku             varchar(40)   not null,
    name            varchar(120),
    quantity        integer       not null check (quantity > 0),
    unit_price      numeric(12, 2),
    status          varchar(16)   not null
);
create index ix_part_line_order on part_line (repair_order_id);

create table outbox_event (
    id             uuid primary key,
    topic          varchar(100) not null,
    aggregate_type varchar(40)  not null,
    aggregate_id   varchar(64)  not null,
    event_type     varchar(60)  not null,
    payload        jsonb        not null,
    created_at     timestamptz  not null default now(),
    published_at   timestamptz
);
create index ix_outbox_unpublished on outbox_event (created_at) where published_at is null;

create table processed_event (
    event_id     uuid primary key,
    processed_at timestamptz not null default now()
);
