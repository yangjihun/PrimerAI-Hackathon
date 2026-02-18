def test_qa_degrades_when_evidence_missing(client, ids):
    response = client.post(
        '/api/qa',
        json={
            'title_id': ids['title_id'],
            'episode_id': ids['episode_id'],
            'current_time_ms': 100,
            'question': 'why is A angry?',
        },
    )

    assert response.status_code == 200
    payload = response.json()

    warning_codes = {warning['code'] for warning in payload['warnings']}
    assert 'EVIDENCE_INSUFFICIENT' in warning_codes
    assert payload['answer']['overall_confidence'] <= 0.35
