-- Teams first saved in edit mode; the client lists them only while it is on.
alter table csa.teams
  add column if not exists edit_mode boolean not null default false;
