create table notification (
    id         uuid primary key,
    event_id   uuid         not null,
    event_type varchar(60)  not null,
    channel    varchar(8)   not null,
    recipient  varchar(120) not null,
    message    varchar(1000) not null,
    sent_at    timestamptz  not null
);
create index ix_notification_recipient on notification (recipient, sent_at desc);
create index ix_notification_sent on notification (sent_at desc);

create table processed_event (
    event_id     uuid primary key,
    processed_at timestamptz not null default now()
);
