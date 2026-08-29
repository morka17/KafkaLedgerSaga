module "eks" {
  source = "../../modules/eks"

  environment         = "production"
  vpc_id              = var.vpc_id
  private_subnet_ids  = var.private_subnet_ids
  node_min_size       = 3
  node_max_size       = 20
  node_desired_size   = 6
  node_instance_types = ["m6i.xlarge"]
}

module "rds" {
  source = "../../modules/rds"

  environment                = "production"
  vpc_id                     = var.vpc_id
  private_subnet_ids         = var.private_subnet_ids
  allowed_security_group_id  = module.eks.cluster_security_group_id
  instance_class             = "db.r6g.large"
  allocated_storage_gb       = 100
  master_password            = var.db_master_password
}

module "msk" {
  source = "../../modules/msk"

  environment               = "production"
  vpc_id                    = var.vpc_id
  private_subnet_ids        = var.private_subnet_ids
  allowed_security_group_id = module.eks.cluster_security_group_id
  broker_count              = 3
  broker_instance_type      = "kafka.m5.xlarge"
  broker_volume_size_gb     = 500
}
