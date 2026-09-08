# Infra

## Local development (`docker/`)

```bash
cp infra/docker/.env.example infra/docker/.env
docker compose -f infra/docker/docker-compose.yml up -d postgres redis
# then run the API/web apps directly with `npm run start:dev` / `npm run dev` for fast iteration,
# or `docker compose -f infra/docker/docker-compose.yml up --build api web` to run everything in containers.
```

## Regional deployment (`terraform/`)

One `environments/<region>` stack per residency zone (`us-east`, `eu-central`, `me-uae`,
`ap-southeast`), each instantiating `modules/regional-stack` — see
docs/MULTI_TENANCY.md#regional-placement for why tenant data is pinned to a region at the
infrastructure layer rather than only checked in application code.

```bash
cd infra/terraform/environments/us-east
terraform init
terraform plan
```

This module is a representative skeleton (VPC, KMS key, RDS Postgres, S3 bucket) — see the header
comment in `modules/regional-stack/main.tf` and the compliance readiness checklist in
`docs/ARCHITECTURE.md` for what a real rollout still needs to fill in (subnet wiring, IAM,
backup/DR runbooks, monitoring, and the legal/compliance work that infrastructure alone can't
satisfy).

Adding a new residency zone (e.g. `me-ksa`, `cn-north`, `ap-south` for Saudi Arabia, China, and
India respectively) is a new `environments/<region>` directory pointing at the same module with a
different `aws_region` — see `docs/COMPLIANCE.md#extending-to-a-new-jurisdiction`.
