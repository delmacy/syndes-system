FROM golang:1.27-bookworm AS build
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 go build -trimpath -o /gateway ./cmd/gateway

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN groupadd -g 10001 gateway && useradd -m -u 10001 -g gateway gateway
COPY --from=build /gateway /usr/local/bin/gateway
RUN mkdir -p /data && chown gateway:gateway /data
USER gateway
ENV GATEWAY_DB=/data/gateway.db GATEWAY_LISTEN=0.0.0.0:8080
VOLUME /data
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/gateway"]
