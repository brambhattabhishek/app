
# Build stage
FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN mvn clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=build /app/target/codelab.jar app.jar

# Local default; Render can override PORT
ENV PORT=8095

EXPOSE 8095

ENTRYPOINT ["sh", "-c", "exec java -jar app.jar --server.port=${PORT:-8095}"]
#commit