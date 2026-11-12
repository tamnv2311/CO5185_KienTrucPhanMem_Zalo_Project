#!/bin/sh
# Runs once, when the MySQL data volume is empty: one schema per service,
# all owned by the application user created from MYSQL_USER / MYSQL_PASSWORD.
set -e

mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE DATABASE IF NOT EXISTS user_db  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS group_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS stats_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON user_db.*  TO '$MYSQL_USER'@'%';
GRANT ALL PRIVILEGES ON group_db.* TO '$MYSQL_USER'@'%';
GRANT ALL PRIVILEGES ON stats_db.* TO '$MYSQL_USER'@'%';
FLUSH PRIVILEGES;
SQL
