#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo $DIR

docker run -d --name mysql -e MYSQL_ROOT_PASSWORD=root -p 3306:3306 percona/percona-server:8.0

sh docker/wait-for/wait-for-mysql.sh

docker exec -it mysql mysql -u root -proot -e "ALTER USER 'root' IDENTIFIED WITH mysql_native_password BY 'root'"
docker exec -it mysql mysql -u root -proot -e "CREATE DATABASE testing;"