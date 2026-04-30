"""Disease Intelligence Agent — Langflow component."""
from langflow.custom import Component
from langflow.io import IntInput, MessageTextInput, Output
from langflow.schema import Data


class DiseaseIntelligenceComponent(Component):
    display_name = "Disease Intelligence Agent"
    description = (
        "Maps a disease query to validated druggable targets using Claude AI, "
        "DisGeNET, UniProt, and PDB."
    )
    icon = "dna"

    inputs = [
        MessageTextInput(
            name="disease_query",
            display_name="Disease Query",
            info="Natural language disease name (e.g., 'Parkinson disease')",
        ),
        IntInput(
            name="max_targets",
            display_name="Max Targets",
            value=3,
            info="Maximum number of drug targets to identify (1–5)",
        ),
    ]

    outputs = [
        Output(display_name="Disease Data", name="disease_data", method="build_disease_data"),
    ]

    async def build_disease_data(self) -> Data:
        from backend.agents.disease_intelligence import DiseaseIntelligenceAgent

        agent = DiseaseIntelligenceAgent()
        disease = await agent.discover_targets(disease_query=self.disease_query)
        return Data(data=disease.model_dump(mode="json"))
