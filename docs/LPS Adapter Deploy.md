# Executive Summary

The LPS Adaptor is an interface that accepts messages from Legacy payment systems (ISO 8583) over TCP and converts it to Mojaloop Open API Requests.

# Introduction

This document explains the procedure for deploying the LPS Adaptor on an Ubuntu environment. The various applications that we used for this process are Docker, Kubernetes and Helm, including many other micro applications and services.

# Pre requisites

## 1.Docker

Docker is a set of platform as a service products that uses OS-level virtualization to deliver software in packages called containers. Containers are isolated from one another and bundle their own software, libraries and configuration files; they can communicate with each other through well-defined channels

    
### Installation

To install Docker Engine - Community, you need the 64-bit version of one of these Ubuntu versions:

- Eoan 19.10
- Bionic 18.04 (LTS)
- Xenial 16.04 (LTS)

**Uninstall old versions**

Older versions of Docker were called docker, docker.io, or docker-engine. If these are installed, uninstall them:

$ sudo apt-get remove docker docker-engine docker.io containerd runc

It&#39;s OK if apt-get reports that none of these packages are installed.

Install Docker on the Ubuntu system as given on the page - **https://docs.docker.com/install/linux/docker-ce/ubuntu/**

## 2.Microk8s

[MicroK8s](https://microk8s.io/) is a [CNCF certified](https://www.cncf.io/certification/software-conformance/) upstream Kubernetes deployment that runs entirely on your workstation or edge device. Being a [snap](https://snapcraft.io/) it runs all Kubernetes services natively (i.e. no virtual machines) while packing the entire set of libraries and binaries needed

MicroK8s will install a minimal, lightweight Kubernetes you can run and use on practically any machine. It can be installed with a snap.

We are using Microk8s for installation of Kubernetes and Helm.

Install Microk8s on the system using the below command for the version 1.15

command - **sudo snap install microk8s --classic --channel=1.15/stable**

Verify installation using the below command

command - **sudo microk8s.ctr version**

![](RackMultipart20200416-4-3ky9as_html_2f19d3b2aa9b2302.png)

MicroK8s bundles its own version of kubectl for accessing Kubernetes. Use it to run commands to monitor and control your Kubernetes. For example, to view your node:

command_-_ **Microk8s.kubectl get nodes**

To install the version from the output list, replace the version 1.15 with the desired version from the output list.

## Kubernetes

Verify Kubernetes installation –

command **- sudo microk8s.kubectl version**

note :-Kubernetes version should be 1.15.9 (Both client and Server)

![](RackMultipart20200416-4-3ky9as_html_38afcabe394925e3.png)

## Helm

command - **sudo microk8s.enable helm**

Initialize helm

command **- sudo microk8s.helm init**

Verify helm installation

command - **sudo microk8s.helm version** (Version should be 2.14.3 both client and server)

![](RackMultipart20200416-4-3ky9as_html_a071011e4ed540d2.png)

Tiller pod verification

command **- sudo microk8s.kubectl -n kube-system get po | grep tiller**

## Nginx Ingress Controller

The docker image for the NGINX ingress controller can be found here - [https://hub.docker.com/r/nginx/nginx-ingress](https://hub.docker.com/r/nginx/nginx-ingress)

NGINX Ingress controller can be installed via [Helm](https://helm.sh/) using the chart [stable/nginx-ingress](https://github.com/kubernetes/charts/tree/master/stable/nginx-ingress) from the official charts repository. To install the chart with the release name my-nginx:

- **helm install my-nginx stable/nginx-ingress**

If the kubernetes cluster has RBAC enabled, then run:

- **helm install my-nginx stable/nginx-ingress --set rbac.create=true**

If you are using [Helm 2](https://v2.helm.sh/) then specify release name using --name flag

- **helm install stable/nginx-ingress --name my-nginx**

or

- **helm install stable/nginx-ingress --name my-nginx --set rbac.create=true**

Detect installed version:

- POD\_NAME=$(kubectl get pods -l app.kubernetes.io/name=ingress-nginx -o jsonpath=&#39;{.items[0].metadata.name}&#39;)

kubectl exec -it $POD\_NAME -- /nginx-ingress-controller --version

# Steps

- We are assuming that the complete source code of the LPS adaptor is uploaded and present on Github which can be accessed publicly.
- We are also assuming that the downloadable contains the Dockerfile integrated along with it.
- Go to a desired folder and open a terminal and perform the below operations
- Download the source code from Github
  - Open a terminal and execute the commands,
  - **git init**
  - **git remote add origin https://github.com/mojaloop/LPS-Adapter.git**
  - **git clone https://github.com/mojaloop/LPS-Adapter**
- After executing these commands, the source code of the LPS adaptor will be downloaded on to the folder where the terminal is opened.
- A Docker image should be built for the LPS adaptor using the dockerfile on the downloaded folder
  - First user must have a dockerhub account. Access and create dockerhub account from - **https://hub.docker.com/**
  - **sudo docker build -t** _ **aptdocker1/lps\_adaptor:0.1** _ **.** (aptdocker1 is the username of the dockerhub account that I am using. lps\_adaptor is the name that I am giving for the docker image and 0.1 is the tag that I am adding to this image)
- A docker image with the given details will be built successfully after running this command.
- This docker image should be published on to Dockerhub for accessing it from everywhere
  - **sudo docker push aptdocker1/lps\_adaptor:0.1**
- The docker image will be pushed onto the Dockerhub repository under the name lps\_adaptor and tag 0.1
- A helm chart should be created for installing a chart release for the lps\_adaptor
  - **sudo microk8s.helm create lpsadaptor**
- The chart named lpsadaptor will be created.
- The structure of the chart will be as follows,

![](RackMultipart20200416-4-3ky9as_html_8f989ac87bbe7e1e.png)

- Open the values.yaml file and change the following part and change the values as given so as to give the chart the image that we have pushed on to the Dockerhub.

![](RackMultipart20200416-4-3ky9as_html_459876720b7dad4.png)

- Add the dependency software on to the requirements.yaml file (after creating it) on the folder.

**dependencies:**

**- name: percona**

**version: 1.2.1**

**repository: https://kubernetes-charts.storage.googleapis.com**

**- name: redis**

**version: 10.5.7**

**repository: https://kubernetes-charts.storage.googleapis.com**

- Update the chart for loading the chart with the given dependency and the values that we changed on the values.yaml file
  - **Sudo microk8s.helm dep update ./lpsadaptor**
- After the update of the charts are completed, install the chart release by setting the service type as Node port as given in the command so that it can be accessed from outside network.
  - **sudo microk8s.helm install –name lpsadaptor ./lpsadaptor –set service.type=NodePort**
- Install nginx ingress controller by adding the repo and install command as given below
  - **sudo microk8s.helm repo add nginx-stable [https://helm.nginx.com/stable](https://helm.nginx.com/stable)**
  - **sudo microk8s.helm repo update**
  - **sudo microk8s.helm install –name adaptornginx nginx-stable/nginx-ingress** (adaptornginx is the name of the release that we give)

## Installation with Chart

We can also create the instance directly by installing the chart that is packed with all the dependencies that are mentioned for the LPS adapter using the below command.

command - sudo microk8s.helm install --name example3 lpsadaptor-0.1.0.tgz --set service.type=NodePort

_Note –_ The name example3 is the sample name that we have given for the release and this chart is set as NodePort for accessing it from outside.

# Dependencies

As of now, there are two dependencies associated with LPS adaptor

- MySQL
- Redis

We can add the dependency software that are required for the chart deployment on a requirements.yaml file. This will help in the installation of these components automatically while deploying the chart.

The requirements.yaml file can be configured as below,

**dependencies:**

**- name: percona**

**version: 1.2.1**

**repository: https://kubernetes-charts.storage.googleapis.com**

**alias: mysql**

**- name: redis**

**version: 10.5.7**

**repository: https://kubernetes-charts.storage.googleapis.com**

**alias: redis**

This will install the 2 dependency specified on the file – MySQL and Redis server during the chart installation.

## 1.MySQL

[MySQL](https://www.mysql.com/) is an open-source database management system, commonly installed as part of the popular [LAMP](https://www.digitalocean.com/community/tutorials/how-to-install-linux-apache-mysql-php-lamp-stack-ubuntu-18-04) (Linux, Apache, MySQL, PHP/Python/Perl) stack. It uses a relational database and SQL (Structured Query Language) to manage its data.

We can get the MySQL Docker image from here - [https://hub.docker.com/\_/mysql](https://hub.docker.com/_/mysql)

## 2.Redis

[Redis](https://redis.io/) is an in-memory key-value store known for its flexibility, performance, and wide language support. This tutorial demonstrates how to install, configure, and secure Redis on an Ubuntu 18.04 server.

We can access the Docker image of the Redis server from here - [https://hub.docker.com/\_/redis](https://hub.docker.com/_/redis)

**Troubleshooting**

For removing the created Helm release we can use the below command

**sudo microk8s.helm del –purge _releasename_**

