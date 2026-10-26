<?php

namespace App\Controller;

use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

final class PuzzleController
{
    /**
     * @Route("/", name="puzzle", methods={"GET"})
     */
    public function index(): Response
    {
        return new Response(file_get_contents(\dirname(__DIR__, 2).'/public/index.html'));
    }
}
