# syntax=docker/dockerfile:1
# Builds any backend service inside Docker, so a server needs nothing but Docker and this repo:
#   docker build --build-arg SERVICE=user-service -t zalolite/user-service .
# The Maven stage is identical for every service, so BuildKit compiles the project once
# and reuses the result for all six images. Both compose files build this way.

FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /src
COPY pom.xml .
COPY libs libs
COPY services services
RUN --mount=type=cache,target=/root/.m2 mvn --batch-mode --quiet -DskipTests package

FROM eclipse-temurin:25-jre
ARG SERVICE
WORKDIR /app
# Run as an unprivileged user; /data is where media-service keeps uploaded files.
RUN useradd --system --create-home app && mkdir -p /data/media && chown -R app /data
COPY --from=build /src/services/${SERVICE}/target/${SERVICE}-*.jar app.jar
USER app
ENTRYPOINT ["java", "-jar", "app.jar"]
