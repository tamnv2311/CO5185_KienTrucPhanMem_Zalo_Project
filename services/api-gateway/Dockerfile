FROM eclipse-temurin:25-jre
WORKDIR /app
COPY target/api-gateway-*.jar app.jar
ENTRYPOINT ["java","-jar","app.jar"]
