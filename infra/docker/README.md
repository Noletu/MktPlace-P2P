# Docker Infrastructure

## Serviços

- **PostgreSQL 16**: Banco de dados principal
- **Redis 7**: Cache e queue management
- **Adminer**: Interface web para gerenciar PostgreSQL

## Uso

### Iniciar todos os serviços
```bash
docker-compose up -d
```

### Ver logs
```bash
docker-compose logs -f
```

### Parar serviços
```bash
docker-compose down
```

### Parar e remover volumes (CUIDADO: apaga dados)
```bash
docker-compose down -v
```

## Acesso

- **PostgreSQL**: `localhost:5432`
  - User: `mktplace`
  - Password: `mktplace_dev_password`
  - Database: `mktplace`

- **Redis**: `localhost:6379`

- **Adminer (UI do PostgreSQL)**: http://localhost:8080
  - System: PostgreSQL
  - Server: postgres
  - Username: mktplace
  - Password: mktplace_dev_password
  - Database: mktplace
