
FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jdk-jammy

WORKDIR /app

# Install tools for all four supported languages
RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ \
    python3 \
    nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/target/codelab.jar app.jar

ENV PORT=8095

EXPOSE 8095

# Verify all language tools during Docker build
RUN javac -version && \
    java -version && \
    g++ --version && \
    python3 --version && \
    node --version

ENTRYPOINT ["sh", "-c", "exec java -jar app.jar --server.port=${PORT:-8095}"]
