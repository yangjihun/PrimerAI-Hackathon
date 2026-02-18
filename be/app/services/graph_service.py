from __future__ import annotations

from sqlalchemy import or_, select

from app.api.schemas import GraphEdge, GraphMeta, GraphNode, GraphResponse, RelationDetailResponse, RelationType, WarningItem
from app.db.models import Character, Evidence as EvidenceModel, Relation
from app.rag.validator import sanitize_evidences
from app.services.evidence_service import load_evidences_for_relation


def _relation_type(value: str) -> RelationType:
    try:
        return RelationType(value)
    except ValueError:
        return RelationType.UNKNOWN


def get_graph(
    db,
    *,
    title_id: str,
    episode_id: str,
    current_time_ms: int,
    focus_character_id: str | None,
    relation_types: list[RelationType] | None,
    include_hypothesis: bool,
) -> GraphResponse:
    warnings: list[WarningItem] = []

    stmt = select(Relation).where(
        Relation.title_id == title_id,
        Relation.valid_from_time_ms <= current_time_ms,
        or_(Relation.valid_to_time_ms.is_(None), Relation.valid_to_time_ms >= current_time_ms),
    )

    if not include_hypothesis:
        stmt = stmt.where(Relation.is_hypothesis.is_(False))

    if relation_types:
        stmt = stmt.where(Relation.relation_type.in_([value.value for value in relation_types]))

    if focus_character_id:
        stmt = stmt.where(
            or_(Relation.from_character_id == focus_character_id, Relation.to_character_id == focus_character_id)
        )

    relations = list(db.scalars(stmt).all())

    char_ids = {rel.from_character_id for rel in relations} | {rel.to_character_id for rel in relations}
    characters = list(db.scalars(select(Character).where(Character.id.in_(char_ids))).all()) if char_ids else []
    char_map = {char.id: char for char in characters}

    nodes = [
        GraphNode(
            id=char.id,
            label=char.canonical_name,
            description=char.description,
            aliases=[alias.alias_text for alias in char.aliases],
        )
        for char in characters
    ]

    edges: list[GraphEdge] = []
    for rel in relations:
        evidences = load_evidences_for_relation(
            db,
            relation_id=rel.id,
            episode_id=episode_id,
            current_time_ms=current_time_ms,
        )
        evidences = sanitize_evidences(
            db,
            evidences=evidences,
            episode_id=episode_id,
            current_time_ms=current_time_ms,
            warnings=warnings,
        )
        if not evidences:
            warnings.append(
                WarningItem(code='EVIDENCE_INSUFFICIENT', message=f'관계 {rel.id}에 대한 근거가 부족합니다.')
            )

        if rel.from_character_id not in char_map or rel.to_character_id not in char_map:
            continue

        edges.append(
            GraphEdge(
                id=rel.id,
                from_character_id=rel.from_character_id,
                to_character_id=rel.to_character_id,
                relation_type=_relation_type(rel.relation_type),
                is_hypothesis=rel.is_hypothesis,
                confidence=rel.confidence,
                valid_from_time_ms=rel.valid_from_time_ms,
                valid_to_time_ms=rel.valid_to_time_ms,
                evidences=evidences,
            )
        )

    deduped_warnings: list[WarningItem] = []
    seen = set()
    for warn in warnings:
        key = (warn.code, warn.message)
        if key not in seen:
            seen.add(key)
            deduped_warnings.append(warn)

    return GraphResponse(
        meta=GraphMeta(
            title_id=title_id,
            episode_id=episode_id,
            current_time_ms=current_time_ms,
            spoiler_guard_applied=True,
        ),
        nodes=nodes,
        edges=edges,
        warnings=deduped_warnings,
    )


def get_relation_detail(db, *, relation_id: str, current_time_ms: int) -> RelationDetailResponse | None:
    relation = db.scalar(
        select(Relation).where(
            Relation.id == relation_id,
            Relation.valid_from_time_ms <= current_time_ms,
            or_(Relation.valid_to_time_ms.is_(None), Relation.valid_to_time_ms >= current_time_ms),
        )
    )
    if relation is None:
        return None

    warnings: list[WarningItem] = []
    evidence_row = db.scalar(
        select(EvidenceModel)
        .where(
            EvidenceModel.relation_id == relation_id,
            EvidenceModel.representative_time_ms <= current_time_ms,
        )
        .order_by(EvidenceModel.representative_time_ms.desc())
    )

    evidences = []
    if evidence_row:
        evidences = load_evidences_for_relation(
            db,
            relation_id=relation_id,
            episode_id=evidence_row.episode_id,
            current_time_ms=current_time_ms,
        )
        evidences = sanitize_evidences(
            db,
            evidences=evidences,
            episode_id=evidence_row.episode_id,
            current_time_ms=current_time_ms,
            warnings=warnings,
        )

    if not evidences:
        warnings.append(WarningItem(code='EVIDENCE_INSUFFICIENT', message='관계 근거를 찾지 못했습니다.'))

    edge = GraphEdge(
        id=relation.id,
        from_character_id=relation.from_character_id,
        to_character_id=relation.to_character_id,
        relation_type=_relation_type(relation.relation_type),
        is_hypothesis=relation.is_hypothesis,
        confidence=relation.confidence,
        valid_from_time_ms=relation.valid_from_time_ms,
        valid_to_time_ms=relation.valid_to_time_ms,
        evidences=evidences,
    )
    return RelationDetailResponse(relation=edge, warnings=warnings)
