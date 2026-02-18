def test_time_guard_blocks_future_evidence(client, ids):
    response = client.post(
        '/api/qa',
        json={
            'title_id': ids['title_id'],
            'episode_id': ids['episode_id'],
            'current_time_ms': 1500,
            'question': 'what happened?',
        },
    )

    assert response.status_code == 200
    payload = response.json()

    for evidence in payload['evidences']:
        for line in evidence['lines']:
            assert line['start_ms'] <= 1500
