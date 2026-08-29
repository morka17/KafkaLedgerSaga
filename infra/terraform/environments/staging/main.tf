module "eks" {
  source = "../../modules/eks"

  environment         = "staging"
  vpc_id              = var.vpc_id
  private_subnet_ids  = var.private_subnet_ids
  node_min_size       = 2
  node_max_size       = 6
  node_desired_size   = 2
  node_instance_types = ["m6i.large"]
}

module "rds" {
  source = "../../modules/rds"

  environment                = "staging"
  vpc_id                     = var.vpc_id
  private_subnet_ids         = var.private_subnet_ids
  allowed_security_group_id  = module.eks.cluster_security_group_id
  instance_class             = "db.t4g.medium"
  master_password            = var.db_master_password
}

module "msk" {
  source = "../../modules/msk"

  environment               = "staging"
  vpc_id                    = var.vpc_id
  private_subnet_ids        = var.private_subnet_ids
  allowed_security_group_id = module.eks.cluster_security_group_id
  broker_count              = 3
  broker_instance_type      = "kafka.m5.large"
}
