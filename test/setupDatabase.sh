docker run -d --name ps -e MYSQL_ROOT_PASSWORD=root -p 3306:3306 percona/percona-server:8.0
docker exec -it ps mysql -u root -proot -e "ALTER USER 'root' IDENTIFIED WITH mysql_native_password BY 'root'"
docker exec -it ps mysql -u root -proot -e "CREATE DATABASE testing;"