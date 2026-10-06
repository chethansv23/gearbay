create table part (
    id            bigint primary key,
    dealer_id     varchar(32)    not null,
    sku           varchar(40)    not null,
    name          varchar(120)   not null,
    fitment       varchar(10)    not null check (fitment in ('CAR', 'BIKE', 'UNIVERSAL')),
    unit_price    numeric(12, 2) not null,
    on_hand       integer        not null,
    reserved      integer        not null default 0,
    reorder_level integer        not null,
    version       bigint         not null default 0,
    unique (dealer_id, sku),
    -- Belt and braces: even a bug in the service cannot promise stock that is not on the shelf.
    constraint ck_part_stock check (reserved >= 0 and reserved <= on_hand)
);

create table reservation (
    id              uuid primary key,
    request_id      uuid        not null unique,
    repair_order_id uuid        not null,
    dealer_id       varchar(32) not null,
    status          varchar(12) not null,
    created_at      timestamptz not null,
    settled_at      timestamptz
);
create index ix_reservation_ro on reservation (repair_order_id, status);

create table reservation_line (
    reservation_id uuid           not null references reservation (id),
    sku            varchar(40)    not null,
    quantity       integer        not null check (quantity > 0),
    unit_price     numeric(12, 2) not null
);

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
