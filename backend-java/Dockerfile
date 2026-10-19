FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=build /app/target/codelab.jar app.jar

ENV PORT=8095

EXPOSE 8095

ENTRYPOINT ["sh", "-c", "exec java -jar app.jar --server.port=${PORT:-8095}"]