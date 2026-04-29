from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Anthropic
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"

    # Database
    database_url: str = "postgresql+asyncpg://cryosis:cryosis@localhost:5432/cryosis"

    # App
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    log_level: str = "INFO"

    # Paths
    cache_dir: Path = Path("./data/cache")
    results_dir: Path = Path("./data/results")
    structures_dir: Path = Path("./data/structures")

    # External APIs
    pubmed_api_key: str = ""
    ncbi_email: str = "cryosis@drugdiscovery.ai"
    pubmed_base_url: str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    uniprot_base_url: str = "https://rest.uniprot.org"
    pdb_base_url: str = "https://data.rcsb.org/rest/v1"
    pdb_files_url: str = "https://files.rcsb.org/download"
    chembl_base_url: str = "https://www.ebi.ac.uk/chembl/api/data"
    disgenet_base_url: str = "https://www.disgenet.org/api"
    alphafold_base_url: str = "https://alphafold.ebi.ac.uk/api"
    arxiv_base_url: str = "https://export.arxiv.org/api/query"
    arxiv_max_results: int = 5

    # Docking
    vina_exhaustiveness: int = 8
    vina_num_modes: int = 9
    max_molecules_per_target: int = 100
    docking_timeout_seconds: int = 120

    # Pipeline
    max_targets: int = 5
    min_molecule_candidates: int = 50

    # MCP — optional tool interface layer (does not affect FastAPI)
    enable_mcp: bool = False

    # Snowflake (optional)
    snowflake_account: str = ""
    snowflake_user: str = ""
    snowflake_password: str = ""
    snowflake_warehouse: str = ""
    snowflake_database: str = ""
    snowflake_schema: str = ""

    # Demo mode — skips slow external API calls and real docking for fast demos
    demo_mode: bool = False
    demo_max_targets: int = 2
    demo_max_molecules: int = 10

    def ensure_dirs(self) -> None:
        for d in (self.cache_dir, self.results_dir, self.structures_dir):
            d.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()
